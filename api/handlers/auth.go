package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"inkmind/api/internal/auth"
	"inkmind/api/middleware"
	"inkmind/api/models"
)

func Register(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Email        string `json:"email" binding:"required,email"`
			Password     string `json:"password" binding:"required,min=6"`
			DisplayName  string `json:"display_name"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请提供邮箱和密码（至少 6 位）"})
			return
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "密码处理失败"})
			return
		}
		u := models.User{
			Email:        body.Email,
			PasswordHash: string(hash),
			DisplayName:  body.DisplayName,
		}
		if err := db.Create(&u).Error; err != nil {
			if strings.Contains(err.Error(), "Duplicate") || strings.Contains(err.Error(), "duplicate") {
				c.JSON(http.StatusConflict, gin.H{"error": "该邮箱已被注册"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		token, _ := auth.IssueToken(u.ID, u.Email)
		c.JSON(http.StatusCreated, gin.H{
			"token": token,
			"user":  userResponse(u),
		})
	}
}

func Login(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Email    string `json:"email" binding:"required"`
			Password string `json:"password" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请提供邮箱和密码"})
			return
		}
		var u models.User
		if err := db.Where("email = ?", body.Email).First(&u).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "邮箱或密码错误"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(body.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "邮箱或密码错误"})
			return
		}
		token, _ := auth.IssueToken(u.ID, u.Email)
		c.JSON(http.StatusOK, gin.H{
			"token": token,
			"user":  userResponse(u),
		})
	}
}

func GetMe(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get(middleware.UserIDKey)
		id := userID.(uint)
		var u models.User
		if err := db.First(&u, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": userResponse(u)})
	}
}

func userResponse(u models.User) gin.H {
	return gin.H{
		"id":           u.ID,
		"email":        u.Email,
		"display_name": u.DisplayName,
		"bio":          u.Bio,
		"avatar_url":   u.AvatarURL,
		"link":         u.Link,
		"location":     u.Location,
		"company":      u.Company,
		"github_url":   u.GithubURL,
		"twitter_url":  u.TwitterURL,
		"created_at":   u.CreatedAt,
		"updated_at":   u.UpdatedAt,
	}
}

