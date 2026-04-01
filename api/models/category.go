package models

// Category 固定分类，不可由用户随意新增
type Category struct {
	ID   uint   `gorm:"primarykey" json:"id"`
	Name string `gorm:"size:64;not null;uniqueIndex" json:"name"`
	Sort int    `gorm:"default:0" json:"sort"` // 排序，越小越靠前
}

func (Category) TableName() string { return "categories" }
