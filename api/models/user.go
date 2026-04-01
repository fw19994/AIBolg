package models

import (
	"time"

	"gorm.io/gorm"
)

// AuthorPublic 文章等场景对外展示的作者信息（不含邮箱等敏感字段）
type AuthorPublic struct {
	ID          uint   `json:"id"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
	Link        string `json:"link,omitempty"`
}

type User struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Email        string `gorm:"size:256;uniqueIndex;not null" json:"email"`
	PasswordHash string `gorm:"size:256;not null" json:"-"`

	DisplayName string `gorm:"size:128" json:"display_name"`
	Bio         string `gorm:"type:text" json:"bio"`
	AvatarURL   string `gorm:"size:512" json:"avatar_url"`
	Link        string `gorm:"size:512" json:"link"`

	Location   string `gorm:"size:128" json:"location"`     // 城市 / 地区
	Company    string `gorm:"size:128" json:"company"`     // 公司或组织
	GithubURL  string `gorm:"size:512" json:"github_url"`  // GitHub 主页
	TwitterURL string `gorm:"size:512" json:"twitter_url"` // X (Twitter) 主页
}
