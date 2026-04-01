package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"inkmind/api/middleware"
	"inkmind/api/models"
)

func GetProfile(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get(middleware.UserIDKey)
		if !exists {
			c.JSON(http.StatusOK, gin.H{"data": nil})
			return
		}
		var u models.User
		if err := db.First(&u, userID.(uint)).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusOK, gin.H{"data": nil})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": u})
	}
}

func UpdateProfile(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get(middleware.UserIDKey)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
			return
		}
		var body struct {
			DisplayName *string `json:"display_name"`
			Bio         *string `json:"bio"`
			AvatarURL   *string `json:"avatar_url"`
			Link        *string `json:"link"`
			Location    *string `json:"location"`
			Company     *string `json:"company"`
			GithubURL   *string `json:"github_url"`
			TwitterURL  *string `json:"twitter_url"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		var u models.User
		if err := db.First(&u, userID.(uint)).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
			return
		}
		updates := make(map[string]interface{})
		if body.DisplayName != nil {
			updates["display_name"] = *body.DisplayName
		}
		if body.Bio != nil {
			updates["bio"] = *body.Bio
		}
		if body.AvatarURL != nil {
			updates["avatar_url"] = *body.AvatarURL
		}
		if body.Link != nil {
			updates["link"] = *body.Link
		}
		if body.Location != nil {
			updates["location"] = *body.Location
		}
		if body.Company != nil {
			updates["company"] = *body.Company
		}
		if body.GithubURL != nil {
			updates["github_url"] = *body.GithubURL
		}
		if body.TwitterURL != nil {
			updates["twitter_url"] = *body.TwitterURL
		}
		if len(updates) > 0 {
			if err := db.Model(&u).Updates(updates).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}
		db.First(&u, userID.(uint))
		c.JSON(http.StatusOK, gin.H{"data": u})
	}
}

// GetUserByID 公开资料，用于作者页（不返回邮箱等敏感信息）
func GetUserByID(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		var u models.User
		if err := db.First(&u, id).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{
			"id":           u.ID,
			"display_name": u.DisplayName,
			"bio":          u.Bio,
			"avatar_url":   u.AvatarURL,
			"link":         u.Link,
			"location":     u.Location,
			"company":      u.Company,
			"github_url":   u.GithubURL,
			"twitter_url":  u.TwitterURL,
		}})
	}
}
