package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"inkmind/api/internal/auth"
)

const UserIDKey = "user_id"

// OptionalAuth 解析 JWT（若有），并设置 user_id 到 context；无 token 不报错
func OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		raw := c.GetHeader("Authorization")
		if raw == "" {
			c.Next()
			return
		}
		parts := strings.SplitN(raw, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.Next()
			return
		}
		claims, err := auth.ParseToken(parts[1])
		if err != nil {
			c.Next()
			return
		}
		c.Set(UserIDKey, claims.UserID)
		c.Set("user_email", claims.Email)
		c.Next()
	}
}

// RequireAuth 要求请求携带有效 JWT，否则 401（需在 OptionalAuth 之后使用或单独解析）
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		raw := c.GetHeader("Authorization")
		if raw == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "未登录或登录已过期"})
			return
		}
		parts := strings.SplitN(raw, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "无效的 Authorization 头"})
			return
		}
		claims, err := auth.ParseToken(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "未登录或登录已过期"})
			return
		}
		c.Set(UserIDKey, claims.UserID)
		c.Set("user_email", claims.Email)
		c.Next()
	}
}
