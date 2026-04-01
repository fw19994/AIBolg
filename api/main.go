package main

import (
	"log"

	"inkmind/api/config"
	"inkmind/api/internal/database"
	"inkmind/api/internal/seed"
	"inkmind/api/models"
	"inkmind/api/routes"
)

func main() {
	if err := config.Load(); err != nil {
		log.Fatalf("config: %v", err)
	}

	maxOpen, maxIdle, maxLifetime := config.DatabasePool()
	db, err := database.Connect(config.DSN(), maxOpen, maxIdle, maxLifetime)
	if err != nil {
		log.Fatalf("database: %v", err)
	}

	if err := db.AutoMigrate(
		&models.User{},
		&models.Category{},
		&models.Tag{},
		&models.Article{},
		&models.ArticleLike{},
		&models.ArticleFavorite{},
		&models.ArticleComment{},
		&models.AiSession{},
		&models.AiMessage{},
	); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	if err := seed.Run(db); err != nil {
		log.Fatalf("seed: %v", err)
	}

	r := routes.Setup(db)
	addr := config.ServerAddr()
	log.Printf("InkMind API [%s] listening on %s", config.AppEnv(), addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server: %v", err)
	}
}
