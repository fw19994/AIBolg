package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"inkmind/api/models"
)

// ListCategories 返回所有固定分类（按 sort、name 排序）
func ListCategories(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var list []models.Category
		if err := db.Order("sort ASC, name ASC").Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": list})
	}
}
