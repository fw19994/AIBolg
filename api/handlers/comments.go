package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"inkmind/api/middleware"
	"inkmind/api/models"
)

const (
	commentMaxLen = 2000
	commentListCap = 200
)

func fillCommentAuthor(c *models.ArticleComment) {
	if c.User == nil {
		return
	}
	u := c.User
	c.Author = &models.AuthorPublic{
		ID:          u.ID,
		DisplayName: u.DisplayName,
		AvatarURL:   u.AvatarURL,
		Link:        u.Link,
	}
}

func articleAllowsComments(a *models.Article, viewerID *uint) bool {
	if a.Status == "published" {
		return true
	}
	if viewerID != nil && a.AuthorID == *viewerID {
		return true
	}
	return false
}

// ListArticleComments 某篇文章的评论列表（时间正序）
func ListArticleComments(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		aid, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		var a models.Article
		if err := db.First(&a, aid).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		var viewerID *uint
		if uidVal, ok := c.Get(middleware.UserIDKey); ok {
			u := uidVal.(uint)
			viewerID = &u
		}
		if !articleAllowsComments(&a, viewerID) {
			c.JSON(http.StatusForbidden, gin.H{"error": "仅已发布文章或作者本人可查看评论"})
			return
		}
		var list []models.ArticleComment
		if err := db.Where("article_id = ?", aid).Preload("User").Order("created_at ASC").Limit(commentListCap).Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		for i := range list {
			fillCommentAuthor(&list[i])
		}
		c.JSON(http.StatusOK, gin.H{"data": list})
	}
}

// PostArticleComment 发表评论
func PostArticleComment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get(middleware.UserIDKey)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
			return
		}
		aid, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		var body struct {
			Content string `json:"content"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		text := strings.TrimSpace(body.Content)
		if text == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "评论内容不能为空"})
			return
		}
		if utf8.RuneCountInString(text) > commentMaxLen {
			c.JSON(http.StatusBadRequest, gin.H{"error": "评论过长（最多 2000 字）"})
			return
		}
		var a models.Article
		if err := db.First(&a, aid).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		uid := userID.(uint)
		vid := uid
		if !articleAllowsComments(&a, &vid) {
			c.JSON(http.StatusForbidden, gin.H{"error": "仅已发布文章或作者本人可评论"})
			return
		}
		row := models.ArticleComment{
			ArticleID: uint(aid),
			UserID:    uid,
			Content:   text,
		}
		if err := db.Create(&row).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		db.Preload("User").First(&row, row.ID)
		fillCommentAuthor(&row)
		c.JSON(http.StatusCreated, gin.H{"data": row})
	}
}

// DeleteArticleComment 删除评论：评论者本人或文章作者
func DeleteArticleComment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get(middleware.UserIDKey)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
			return
		}
		aid, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		cid, err := strconv.ParseUint(c.Param("cid"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid comment id"})
			return
		}
		var a models.Article
		if err := db.First(&a, aid).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		var row models.ArticleComment
		if err := db.Where("id = ? AND article_id = ?", cid, aid).First(&row).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		uid := userID.(uint)
		if row.UserID != uid && a.AuthorID != uid {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权删除此文下评论"})
			return
		}
		if err := db.Delete(&models.ArticleComment{}, cid).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}
