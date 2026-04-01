package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"inkmind/api/middleware"
	"inkmind/api/models"
)

type createAiSessionBody struct {
	ArticleID *uint `json:"article_id"`
}

type aiSessionTurnBody struct {
	Text        string `json:"text"`
	Instruction string `json:"instruction"`
}

type assistantStored struct {
	Optimized string `json:"optimized"`
	Benefits  string `json:"benefits"`
}

// assistantDBToModelFormat 将库中 assistant 的 JSON 转为与模型约定一致的带标记文本，便于多轮续写
func assistantDBToModelFormat(stored string) string {
	var p assistantStored
	if err := json.Unmarshal([]byte(stored), &p); err != nil {
		return stored
	}
	return markerOptimized + "\n" + strings.TrimSpace(p.Optimized) + "\n" + markerBenefits + "\n" + strings.TrimSpace(p.Benefits)
}

// CreateAiSession 创建多轮会话（可选关联当前编辑的文章）
func CreateAiSession(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		uidVal, ok := c.Get(middleware.UserIDKey)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
			return
		}
		userID := uidVal.(uint)

		var body createAiSessionBody
		_ = c.ShouldBindJSON(&body)

		if body.ArticleID != nil {
			var art models.Article
			if err := db.First(&art, *body.ArticleID).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					c.JSON(http.StatusNotFound, gin.H{"error": "文章不存在"})
					return
				}
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if art.AuthorID != userID {
				c.JSON(http.StatusForbidden, gin.H{"error": "无权关联该文章"})
				return
			}
		}

		s := models.AiSession{UserID: userID, ArticleID: body.ArticleID}
		if err := db.Create(&s).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"id": s.ID, "article_id": s.ArticleID}})
	}
}

// GetAiSession 返回会话及消息（用于刷新或调试；assistant 展开 optimized / benefits）
func GetAiSession(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		uidVal, ok := c.Get(middleware.UserIDKey)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
			return
		}
		userID := uidVal.(uint)

		id64, err := strconv.ParseUint(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的会话 id"})
			return
		}
		sid := uint(id64)

		var sess models.AiSession
		if err := db.Preload("Messages", func(db *gorm.DB) *gorm.DB {
			return db.Order("seq ASC")
		}).First(&sess, "id = ? AND user_id = ?", sid, userID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "会话不存在"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		outMsgs := make([]gin.H, 0, len(sess.Messages))
		for _, m := range sess.Messages {
			item := gin.H{
				"id":   m.ID,
				"seq":  m.Seq,
				"role": m.Role,
			}
			if m.Role == "assistant" {
				var p assistantStored
				if json.Unmarshal([]byte(m.Content), &p) == nil {
					item["optimized"] = p.Optimized
					item["benefits"] = p.Benefits
				} else {
					item["content"] = m.Content
				}
			} else {
				item["content"] = m.Content
			}
			outMsgs = append(outMsgs, item)
		}

		c.JSON(http.StatusOK, gin.H{
			"data": gin.H{
				"id":         sess.ID,
				"article_id": sess.ArticleID,
				"messages":   outMsgs,
			},
		})
	}
}

// AiSessionTurn 多轮中的一轮：从数据库拼历史，调用模型，再写入 user + assistant 两条消息
func AiSessionTurn(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		uidVal, ok := c.Get(middleware.UserIDKey)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
			return
		}
		userID := uidVal.(uint)

		id64, err := strconv.ParseUint(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的会话 id"})
			return
		}
		sid := uint(id64)

		var req aiSessionTurnBody
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的 JSON 请求体"})
			return
		}
		userPrompt := buildOptimizeUserPrompt(req.Text, req.Instruction)
		if userPrompt == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请提供正文，或在对话中说明你的要求"})
			return
		}

		var sess models.AiSession
		if err := db.First(&sess, "id = ? AND user_id = ?", sid, userID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "会话不存在"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var prior []models.AiMessage
		if err := db.Where("session_id = ?", sess.ID).Order("seq ASC").Find(&prior).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		msgs := []openAIMsg{{Role: "system", Content: optimizeSystemContent}}
		for _, m := range prior {
			role := strings.ToLower(strings.TrimSpace(m.Role))
			if role != "user" && role != "assistant" {
				continue
			}
			content := m.Content
			if role == "assistant" {
				content = assistantDBToModelFormat(m.Content)
			}
			msgs = append(msgs, openAIMsg{Role: role, Content: content})
		}
		msgs = append(msgs, openAIMsg{Role: "user", Content: userPrompt})

		opt, ben, err := chatCompletionOptimizeWithRetry(c.Request.Context(), msgs)
		if err != nil {
			if strings.Contains(err.Error(), "AI 未配置") {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		assistJSON, err := json.Marshal(assistantStored{Optimized: opt, Benefits: ben})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		err = db.Transaction(func(tx *gorm.DB) error {
			var last models.AiMessage
			nextSeq := 1
			err := tx.Where("session_id = ?", sess.ID).Order("seq DESC").Limit(1).First(&last).Error
			if err == nil {
				nextSeq = last.Seq + 1
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}

			u := models.AiMessage{
				SessionID: sess.ID,
				Seq:       nextSeq,
				Role:      "user",
				Content:   userPrompt,
			}
			if err := tx.Create(&u).Error; err != nil {
				return err
			}
			a := models.AiMessage{
				SessionID: sess.ID,
				Seq:       nextSeq + 1,
				Role:      "assistant",
				Content:   string(assistJSON),
			}
			return tx.Create(&a).Error
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"optimized": opt, "benefits": ben})
	}
}
