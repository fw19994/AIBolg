package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"runtime/debug"
	"strconv"
	"strings"

	"github.com/cloudwego/eino/adk"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"inkmind/api/middleware"
	"inkmind/api/models"
)

func initSSEWriter(c *gin.Context) (writeData func(map[string]any) error, err error) {
	w := c.Writer
	h := w.Header()
	h.Set("Content-Type", "text/event-stream; charset=utf-8")
	h.Set("Cache-Control", "no-cache")
	h.Set("Connection", "keep-alive")
	h.Set("X-Accel-Buffering", "no")
	flusher, ok := w.(http.Flusher)
	if !ok {
		return nil, fmt.Errorf("响应不支持流式输出")
	}
	writeData = func(v map[string]any) error {
		b, e := json.Marshal(v)
		if e != nil {
			return e
		}
		if _, e := fmt.Fprintf(w, "data: %s\n\n", b); e != nil {
			return e
		}
		flusher.Flush()
		return nil
	}
	w.WriteHeader(http.StatusOK)
	return writeData, nil
}

// streamEditorRawFromIterator 将 Agent 流式事件转为 SSE delta，并返回拼接后的完整文本（用于解析标记）。
func streamEditorRawFromIterator(iter *adk.AsyncIterator[*adk.AgentEvent], writeData func(map[string]any) error) (string, error) {
	var wrote bool
	var acc strings.Builder
	for {
		ev, ok := iter.Next()
		if !ok {
			break
		}
		if ev.Err != nil {
			_ = writeData(map[string]any{"error": ev.Err.Error()})
			return "", ev.Err
		}
		if ev.Output == nil || ev.Output.MessageOutput == nil {
			continue
		}
		n, err := writeMessageVariantSSE(writeData, ev.Output.MessageOutput, &acc)
		if err != nil {
			_ = writeData(map[string]any{"error": err.Error()})
			return acc.String(), err
		}
		if n > 0 {
			wrote = true
		}
	}
	if !wrote {
		return "", fmt.Errorf("模型未返回有效内容")
	}
	return acc.String(), nil
}

// streamOptimizeChain 首轮 SSE 流式输出，解析失败则非流式重试，最后 data: {"done":true,"optimized","benefits"}。
func streamOptimizeChain(c *gin.Context, ctx context.Context, initial []openAIMsg, persist func(opt, ben string) error) error {
	msgs := append([]openAIMsg(nil), initial...)
	var writeData func(map[string]any) error

	for attempt := 0; attempt < maxOptimizeParseAttempts; attempt++ {
		var raw string
		var err error
		if attempt == 0 {
			iter, err := newEditorAgentStreamIterator(ctx, msgs)
			if err != nil {
				return err
			}
			var errInit error
			writeData, errInit = initSSEWriter(c)
			if errInit != nil {
				return errInit
			}
			raw, err = streamEditorRawFromIterator(iter, writeData)
			if err != nil {
				_ = writeData(map[string]any{"error": err.Error()})
				return err
			}
		} else {
			if err := writeData(map[string]any{"status": "retrying"}); err != nil {
				return err
			}
			raw, err = chatCompletionViaAgent(ctx, msgs)
			if err != nil {
				_ = writeData(map[string]any{"error": err.Error()})
				return err
			}
		}

		opt, ben, perr := parseOptimizeOutput(raw)
		if perr == nil {
			if persist != nil {
				if err := persist(opt, ben); err != nil {
					_ = writeData(map[string]any{"error": err.Error()})
					return err
				}
			}
			return writeData(map[string]any{"done": true, "optimized": opt, "benefits": ben})
		}
		if attempt == maxOptimizeParseAttempts-1 {
			_ = writeData(map[string]any{"error": perr.Error()})
			return perr
		}
		msgs = append(msgs, openAIMsg{Role: "assistant", Content: truncateStringRunes(raw, maxRepairAssistantRunes)})
		msgs = append(msgs, openAIMsg{Role: "user", Content: repairFormatUserMessage()})
	}
	return fmt.Errorf("模型未按约定格式返回")
}

// AiOptimizeStream 对话编辑单轮，SSE：delta + 最终 done（含 optimized/benefits）。
func AiOptimizeStream() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[ai-optimize-stream] PANIC: %v\n%s", r, debug.Stack())
				if !c.Writer.Written() {
					c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "内部错误"})
				}
			}
		}()

		var req AiOptimizeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的 JSON 请求体"})
			return
		}
		userPrompt := buildOptimizeUserPrompt(req.Text, req.Instruction)
		if userPrompt == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请提供正文，或在对话中说明你的要求"})
			return
		}
		msgs := []openAIMsg{
			{Role: "system", Content: optimizeSystemContent},
			{Role: "user", Content: userPrompt},
		}

		if err := streamOptimizeChain(c, c.Request.Context(), msgs, nil); err != nil {
			log.Printf("[ai-optimize-stream] %v", err)
			if !c.Writer.Written() {
				if strings.Contains(err.Error(), "AI 未配置") {
					c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			}
		}
	}
}

// AiSessionTurnStream 多轮对话一轮，SSE 流式 + 成功后落库（与 AiSessionTurn 一致）。
func AiSessionTurnStream(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[ai-session-turn-stream] PANIC: %v\n%s", r, debug.Stack())
				if !c.Writer.Written() {
					c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "内部错误"})
				}
			}
		}()

		uidVal, ok := c.Get(middleware.UserIDKey)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
			return
		}
		userID, ok := uidVal.(uint)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "会话异常"})
			return
		}

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

		persist := func(opt, ben string) error {
			assistJSON, err := json.Marshal(assistantStored{Optimized: opt, Benefits: ben})
			if err != nil {
				return err
			}
			return db.Transaction(func(tx *gorm.DB) error {
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
		}

		if err := streamOptimizeChain(c, c.Request.Context(), msgs, persist); err != nil {
			log.Printf("[ai-session-turn-stream] %v", err)
			if !c.Writer.Written() {
				if strings.Contains(err.Error(), "AI 未配置") {
					c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			}
		}
	}
}
