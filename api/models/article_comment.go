package models

import "time"

// ArticleComment 文章评论（正文为纯文本，不含 HTML）
type ArticleComment struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	ArticleID uint          `gorm:"not null;index" json:"article_id"`
	UserID    uint          `gorm:"not null;index" json:"user_id"`
	User      *User         `gorm:"foreignKey:UserID" json:"-"`
	Author    *AuthorPublic `gorm:"-" json:"author,omitempty"`
	Content   string        `gorm:"type:text;not null" json:"content"`
}
