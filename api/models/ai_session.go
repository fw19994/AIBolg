package models

import (
	"time"

	"gorm.io/gorm"
)

// AiSession 多轮对话编辑会话（按用户隔离，可选关联文章）
type AiSession struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	UserID    uint  `gorm:"not null;index" json:"user_id"`
	ArticleID *uint `gorm:"index" json:"article_id,omitempty"`

	User     User         `gorm:"foreignKey:UserID" json:"-"`
	Messages []AiMessage  `gorm:"foreignKey:SessionID;order:seq" json:"messages,omitempty"`
}

// AiMessage 会话内一条消息（user / assistant），Seq 在会话内递增
type AiMessage struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	SessionID uint   `gorm:"not null;index;uniqueIndex:ux_ai_msg_session_seq,priority:1" json:"session_id"`
	Seq       int    `gorm:"not null;uniqueIndex:ux_ai_msg_session_seq,priority:2" json:"seq"`
	Role      string `gorm:"size:16;not null" json:"role"` // user | assistant
	Content   string `gorm:"type:longtext;not null" json:"content"`

	Session AiSession `gorm:"foreignKey:SessionID" json:"-"`
}
