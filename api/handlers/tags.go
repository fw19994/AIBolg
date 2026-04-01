package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"inkmind/api/models"
)

// ListTags 返回所有固定标签（按 sort、name 排序）
func ListTags(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var list []models.Tag
		if err := db.Order("sort ASC, name ASC").Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": list})
	}
}
