package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"inkmind/api/config"
	"inkmind/api/handlers"
	"inkmind/api/middleware"
)

func Setup(db *gorm.DB) *gin.Engine {
	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	api := r.Group(config.APIBasePath())
	api.Use(middleware.OptionalAuth())
	{
		api.GET("/health", handlers.Health)
		api.GET("/categories", handlers.ListCategories(db))
		api.GET("/tags", handlers.ListTags(db))
		api.GET("/articles", handlers.ListArticles(db))
		api.POST("/articles/:id/like", middleware.RequireAuth(), handlers.PostArticleLike(db))
		api.DELETE("/articles/:id/like", middleware.RequireAuth(), handlers.DeleteArticleLike(db))
		api.POST("/articles/:id/favorite", middleware.RequireAuth(), handlers.PostArticleFavorite(db))
		api.DELETE("/articles/:id/favorite", middleware.RequireAuth(), handlers.DeleteArticleFavorite(db))
		api.GET("/articles/:id/comments", handlers.ListArticleComments(db))
		api.POST("/articles/:id/comments", middleware.RequireAuth(), handlers.PostArticleComment(db))
		api.DELETE("/articles/:id/comments/:cid", middleware.RequireAuth(), handlers.DeleteArticleComment(db))
		api.GET("/articles/:id", handlers.GetArticle(db))
		api.GET("/profile", handlers.GetProfile(db))
		api.GET("/users/:id", handlers.GetUserByID(db))

		// 以下需要登录
		api.POST("/auth/register", handlers.Register(db))
		api.POST("/auth/login", handlers.Login(db))
		api.GET("/auth/me", middleware.RequireAuth(), handlers.GetMe(db))
		api.POST("/articles", middleware.RequireAuth(), handlers.CreateArticle(db))
		api.PATCH("/articles/:id", middleware.RequireAuth(), handlers.UpdateArticle(db))
		api.DELETE("/articles/:id", middleware.RequireAuth(), handlers.DeleteArticle(db))
		api.GET("/favorites", middleware.RequireAuth(), handlers.ListMyFavorites(db))
		api.PUT("/profile", middleware.RequireAuth(), handlers.UpdateProfile(db))
		api.POST("/upload", middleware.RequireAuth(), handlers.UploadImage())
		api.POST("/ai/chat", middleware.RequireAuth(), handlers.AiChat())
		api.POST("/ai/optimize", middleware.RequireAuth(), handlers.AiOptimize())
		api.POST("/ai/optimize/stream", middleware.RequireAuth(), handlers.AiOptimizeStream())
		api.POST("/ai/sessions", middleware.RequireAuth(), handlers.CreateAiSession(db))
		api.GET("/ai/sessions/:id", middleware.RequireAuth(), handlers.GetAiSession(db))
		api.POST("/ai/sessions/:id/turn", middleware.RequireAuth(), handlers.AiSessionTurn(db))
		api.POST("/ai/sessions/:id/turn/stream", middleware.RequireAuth(), handlers.AiSessionTurnStream(db))
		// 阅读页 AI：Eino ChatModelAgent，与 AI 写作链路隔离（路径见 config.APIBasePath）
		api.POST("/read-agent/chat", middleware.RequireAuth(), handlers.ReadAgentChat(db))
		api.POST("/read-agent/chat/stream", middleware.RequireAuth(), handlers.ReadAgentChatStream(db))
	}

	// 静态访问上传的图片（开发/同机部署时使用）
	r.Static("/uploads", config.UploadDir())

	return r
}
