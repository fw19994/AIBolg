package models

import "time"

// ArticleLike 用户对文章的点赞（同一用户对同一文章仅一条）
type ArticleLike struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UserID    uint      `gorm:"not null;uniqueIndex:ux_article_like_pair"`
	ArticleID uint      `gorm:"not null;uniqueIndex:ux_article_like_pair"`
}

// ArticleFavorite 用户收藏文章
type ArticleFavorite struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UserID    uint      `gorm:"not null;uniqueIndex:ux_article_fav_pair"`
	ArticleID uint      `gorm:"not null;uniqueIndex:ux_article_fav_pair"`
}
