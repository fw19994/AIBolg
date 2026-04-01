package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"inkmind/api/middleware"
	"inkmind/api/models"
)

// ListMyFavorites 当前用户收藏的文章（按收藏时间倒序；仅包含已发布或本人草稿）
func ListMyFavorites(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get(middleware.UserIDKey)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
			return
		}
		uid := userID.(uint)
		var list []models.Article
		q := db.Model(&models.Article{}).
			Joins("INNER JOIN article_favorites ON article_favorites.article_id = articles.id AND article_favorites.user_id = ?", uid).
			Where("articles.status = ? OR articles.author_id = ?", "published", uid).
			Preload("Category").
			Preload("Tags").
			Preload("Author").
			Order("article_favorites.created_at DESC")
		if err := q.Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		attachArticleListReactionCounts(db, list)
		fillArticleAuthorPublics(list)
		c.JSON(http.StatusOK, gin.H{"data": list})
	}
}

// attachArticleListReactionCounts 为文章列表批量填充点赞数、收藏数（仅 JSON 输出，非表字段）
func attachArticleListReactionCounts(db *gorm.DB, list []models.Article) {
	if len(list) == 0 {
		return
	}
	ids := make([]uint, len(list))
	for i := range list {
		ids[i] = list[i].ID
	}
	likeMap := map[uint]int64{}
	var likeRows []struct {
		ArticleID uint  `gorm:"column:article_id"`
		N         int64 `gorm:"column:n"`
	}
	db.Raw(`SELECT article_id, COUNT(*) AS n FROM article_likes WHERE article_id IN ? GROUP BY article_id`, ids).Scan(&likeRows)
	for _, r := range likeRows {
		likeMap[r.ArticleID] = r.N
	}
	favMap := map[uint]int64{}
	var favRows []struct {
		ArticleID uint  `gorm:"column:article_id"`
		N         int64 `gorm:"column:n"`
	}
	db.Raw(`SELECT article_id, COUNT(*) AS n FROM article_favorites WHERE article_id IN ? GROUP BY article_id`, ids).Scan(&favRows)
	for _, r := range favRows {
		favMap[r.ArticleID] = r.N
	}
	for i := range list {
		list[i].LikeCount = likeMap[list[i].ID]
		list[i].FavoriteCount = favMap[list[i].ID]
	}
}

func reactionMeta(db *gorm.DB, c *gin.Context, articleID uint) (likeCount, favCount int64, liked, favorited bool) {
	db.Model(&models.ArticleLike{}).Where("article_id = ?", articleID).Count(&likeCount)
	db.Model(&models.ArticleFavorite{}).Where("article_id = ?", articleID).Count(&favCount)
	if uidVal, ok := c.Get(middleware.UserIDKey); ok {
		uid := uidVal.(uint)
		var n int64
		db.Model(&models.ArticleLike{}).Where("article_id = ? AND user_id = ?", articleID, uid).Count(&n)
		liked = n > 0
		n = 0
		db.Model(&models.ArticleFavorite{}).Where("article_id = ? AND user_id = ?", articleID, uid).Count(&n)
		favorited = n > 0
	}
	return
}

// PostArticleLike 点赞（幂等：已点赞则不变）
func PostArticleLike(db *gorm.DB) gin.HandlerFunc {
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
		var like models.ArticleLike
		qerr := db.Where("user_id = ? AND article_id = ?", uid, uint(aid)).First(&like).Error
		if qerr == gorm.ErrRecordNotFound {
			like = models.ArticleLike{UserID: uid, ArticleID: uint(aid)}
			if err := db.Create(&like).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}
		var cnt int64
		db.Model(&models.ArticleLike{}).Where("article_id = ?", aid).Count(&cnt)
		c.JSON(http.StatusOK, gin.H{"like_count": cnt, "liked": true})
	}
}

// DeleteArticleLike 取消点赞
func DeleteArticleLike(db *gorm.DB) gin.HandlerFunc {
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
		uid := userID.(uint)
		db.Where("user_id = ? AND article_id = ?", uid, uint(aid)).Delete(&models.ArticleLike{})
		var cnt int64
		db.Model(&models.ArticleLike{}).Where("article_id = ?", aid).Count(&cnt)
		c.JSON(http.StatusOK, gin.H{"like_count": cnt, "liked": false})
	}
}

// PostArticleFavorite 收藏
func PostArticleFavorite(db *gorm.DB) gin.HandlerFunc {
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
		var fav models.ArticleFavorite
		qerr := db.Where("user_id = ? AND article_id = ?", uid, uint(aid)).First(&fav).Error
		if qerr == gorm.ErrRecordNotFound {
			fav = models.ArticleFavorite{UserID: uid, ArticleID: uint(aid)}
			if err := db.Create(&fav).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}
		var cnt int64
		db.Model(&models.ArticleFavorite{}).Where("article_id = ?", aid).Count(&cnt)
		c.JSON(http.StatusOK, gin.H{"favorite_count": cnt, "favorited": true})
	}
}

// DeleteArticleFavorite 取消收藏
func DeleteArticleFavorite(db *gorm.DB) gin.HandlerFunc {
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
		uid := userID.(uint)
		db.Where("user_id = ? AND article_id = ?", uid, uint(aid)).Delete(&models.ArticleFavorite{})
		var cnt int64
		db.Model(&models.ArticleFavorite{}).Where("article_id = ?", aid).Count(&cnt)
		c.JSON(http.StatusOK, gin.H{"favorite_count": cnt, "favorited": false})
	}
}
