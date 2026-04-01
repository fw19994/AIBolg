package seed

import (
	"gorm.io/gorm"

	"inkmind/api/models"
)

// Categories 与 Tags 的固定初始数据
var (
	defaultCategories = []models.Category{
		{Name: "技术", Sort: 10},
		{Name: "生活", Sort: 20},
		{Name: "随笔", Sort: 30},
		{Name: "读书", Sort: 40},
	}
	defaultTags = []models.Tag{
		{Name: "前端", Sort: 10},
		{Name: "后端", Sort: 20},
		{Name: "Go", Sort: 30},
		{Name: "笔记", Sort: 40},
		{Name: "教程", Sort: 50},
	}
)

// Run 在空表时插入固定分类与标签，已存在则跳过
func Run(db *gorm.DB) error {
	for i := range defaultCategories {
		c := &defaultCategories[i]
		if err := db.Where("name = ?", c.Name).FirstOrCreate(c).Error; err != nil {
			return err
		}
	}
	for i := range defaultTags {
		t := &defaultTags[i]
		if err := db.Where("name = ?", t.Name).FirstOrCreate(t).Error; err != nil {
			return err
		}
	}
	return nil
}
