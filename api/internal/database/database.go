package database

import (
	"log"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// Connect 使用 MySQL DSN 建立连接，并可设置连接池
func Connect(dsn string, maxOpen, maxIdle int, maxLifetime time.Duration) (*gorm.DB, error) {
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	if maxOpen > 0 {
		sqlDB.SetMaxOpenConns(maxOpen)
	}
	if maxIdle > 0 {
		sqlDB.SetMaxIdleConns(maxIdle)
	}
	if maxLifetime > 0 {
		sqlDB.SetConnMaxLifetime(maxLifetime)
	}

	log.Printf("database: mysql connected (pool maxOpen=%d maxIdle=%d)", maxOpen, maxIdle)
	return db, nil
}
