package models

// Tag 固定标签，不可由用户随意新增
type Tag struct {
	ID   uint   `gorm:"primarykey" json:"id"`
	Name string `gorm:"size:64;not null;uniqueIndex" json:"name"`
	Sort int    `gorm:"default:0" json:"sort"` // 排序
}

func (Tag) TableName() string { return "tags" }
