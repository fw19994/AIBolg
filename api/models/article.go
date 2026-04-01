package models

import (
	"time"

	"gorm.io/gorm"
)

// Article 文章，分类与标签通过外键关联固定表
type Article struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	AuthorID    uint       `gorm:"not null;index" json:"author_id"`
	Author      *User      `gorm:"foreignKey:AuthorID" json:"-"`
	AuthorPublic *AuthorPublic `gorm:"-" json:"author,omitempty"`

	Title       string     `gorm:"size:256;not null" json:"title"`
	Slug        string     `gorm:"size:256;uniqueIndex" json:"slug"`
	Body        string     `gorm:"type:text" json:"body"`
	CoverURL    string     `gorm:"size:512" json:"cover_url"`
	CategoryID  *uint      `gorm:"index" json:"category_id"`
	Category    *Category  `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Tags        []Tag      `gorm:"many2many:article_tags;" json:"tags,omitempty"`
	Status      string     `gorm:"size:32;default:draft" json:"status"` // draft | published
	PublishedAt *time.Time `json:"published_at"`

	// 列表接口填充，非数据库列
	LikeCount     int64 `gorm:"-" json:"like_count"`
	FavoriteCount int64 `gorm:"-" json:"favorite_count"`
}
