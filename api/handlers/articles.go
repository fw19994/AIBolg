package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"inkmind/api/middleware"
	"inkmind/api/models"
	"strings"
)

func fillArticleAuthorPublic(a *models.Article) {
	if a.Author == nil {
		return
	}
	u := a.Author
	a.AuthorPublic = &models.AuthorPublic{
		ID:          u.ID,
		DisplayName: u.DisplayName,
		AvatarURL:   u.AvatarURL,
		Link:        u.Link,
	}
}

func fillArticleAuthorPublics(list []models.Article) {
	for i := range list {
		fillArticleAuthorPublic(&list[i])
	}
}

func ListArticles(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		status := c.Query("status")
		categoryIDStr := c.Query("category_id")
		tagIDStr := c.Query("tag_id")
		authorIDStr := c.Query("author_id")

		var list []models.Article
		q := db.Model(&models.Article{}).Preload("Category").Preload("Tags").Preload("Author")
		userID, hasUser := c.Get(middleware.UserIDKey)

		if status == "draft" {
			if !hasUser {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
				return
			}
			q = q.Where("status = ?", status).Where("author_id = ?", userID.(uint))
		} else if status == "published" {
			q = q.Where("status = ?", status)
			if authorIDStr != "" {
				if aid, err := strconv.ParseUint(authorIDStr, 10, 32); err == nil {
					q = q.Where("author_id = ?", uint(aid))
				}
			}
		} else {
			if hasUser {
				q = q.Where("author_id = ?", userID.(uint))
			} else {
				q = q.Where("status = ?", "published")
			}
		}

		if categoryIDStr != "" {
			if cid, err := strconv.ParseUint(categoryIDStr, 10, 32); err == nil {
				q = q.Where("category_id = ?", uint(cid))
			}
		}
		if tagIDStr != "" {
			if tid, err := strconv.ParseUint(tagIDStr, 10, 32); err == nil {
				q = q.Where("id IN (SELECT article_id FROM article_tags WHERE tag_id = ?)", uint(tid))
			}
		}

		if err := q.Order("updated_at DESC").Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		attachArticleListReactionCounts(db, list)
		fillArticleAuthorPublics(list)
		c.JSON(http.StatusOK, gin.H{"data": list})
	}
}

func GetArticle(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		var a models.Article
		if err := db.Preload("Category").Preload("Tags").Preload("Author").First(&a, id).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		fillArticleAuthorPublic(&a)
		lc, fc, liked, favorited := reactionMeta(db, c, uint(id))
		a.LikeCount = lc
		a.FavoriteCount = fc
		c.JSON(http.StatusOK, gin.H{
			"data":           a,
			"like_count":     lc,
			"favorite_count": fc,
			"liked":          liked,
			"favorited":      favorited,
		})
	}
}

func CreateArticle(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get(middleware.UserIDKey)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
			return
		}
		authorID := userID.(uint)
		var body struct {
			Title      string  `json:"title"`
			Body       string  `json:"body"`
			Slug       string  `json:"slug"`
			CoverURL   string  `json:"cover_url"`
			CategoryID *uint   `json:"category_id"`
			TagIDs     []uint  `json:"tag_ids"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		a := models.Article{
			AuthorID:   authorID,
			Title:      body.Title,
			Slug:       body.Slug,
			Body:       body.Body,
			CoverURL:   strings.TrimSpace(body.CoverURL),
			CategoryID: body.CategoryID,
			Status:     "draft",
		}
		if err := db.Create(&a).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if a.Slug == "" {
			a.Slug = strconv.FormatUint(uint64(a.ID), 10)
			db.Model(&a).Update("slug", a.Slug)
		}
		if len(body.TagIDs) > 0 {
			var tags []models.Tag
			if db.Where("id IN ?", body.TagIDs).Find(&tags); len(tags) > 0 {
				db.Model(&a).Association("Tags").Replace(tags)
			}
		}
		db.Preload("Category").Preload("Tags").Preload("Author").First(&a, a.ID)
		fillArticleAuthorPublic(&a)
		c.JSON(http.StatusCreated, gin.H{"data": a})
	}
}

func UpdateArticle(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		var body struct {
			Title      *string `json:"title"`
			Body       *string `json:"body"`
			Slug       *string `json:"slug"`
			CoverURL   *string `json:"cover_url"`
			CategoryID *uint   `json:"category_id"`
			TagIDs     []uint  `json:"tag_ids"`
			Status     *string `json:"status"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		var a models.Article
		if err := db.First(&a, id).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		uid, _ := c.Get(middleware.UserIDKey)
		if uid != nil && a.AuthorID != uid.(uint) {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权修改此文"})
			return
		}
		updates := make(map[string]interface{})
		if body.Title != nil {
			updates["title"] = *body.Title
		}
		if body.Body != nil {
			updates["body"] = *body.Body
		}
		if body.Slug != nil {
			updates["slug"] = *body.Slug
		}
		if body.CoverURL != nil {
			updates["cover_url"] = strings.TrimSpace(*body.CoverURL)
		}
		if body.CategoryID != nil {
			updates["category_id"] = body.CategoryID
		}
		if body.Status != nil {
			updates["status"] = *body.Status
			if *body.Status == "published" && a.PublishedAt == nil {
				now := time.Now()
				updates["published_at"] = now
			}
		}
		if len(updates) > 0 {
			if err := db.Model(&a).Updates(updates).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}
		if body.TagIDs != nil {
			var tags []models.Tag
			if len(body.TagIDs) > 0 {
				db.Where("id IN ?", body.TagIDs).Find(&tags)
			}
			db.Model(&a).Association("Tags").Replace(tags)
		}
		db.Preload("Category").Preload("Tags").Preload("Author").First(&a, id)
		fillArticleAuthorPublic(&a)
		c.JSON(http.StatusOK, gin.H{"data": a})
	}
}

func DeleteArticle(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		var a models.Article
		if err := db.First(&a, id).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		uid, _ := c.Get(middleware.UserIDKey)
		if uid != nil && a.AuthorID != uid.(uint) {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权删除此文"})
			return
		}
		db.Where("article_id = ?", id).Delete(&models.ArticleLike{})
		db.Where("article_id = ?", id).Delete(&models.ArticleFavorite{})
		db.Where("article_id = ?", id).Delete(&models.ArticleComment{})
		if err := db.Delete(&models.Article{}, id).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}
