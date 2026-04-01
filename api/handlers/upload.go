package handlers

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"inkmind/api/config"
	"inkmind/api/middleware"
)

const maxUploadSize = 10 << 20 // 10MB
var allowedImageTypes = map[string]bool{
	"image/jpeg": true, "image/jpg": true, "image/png": true,
	"image/gif": true, "image/webp": true,
}

// UploadImage 要求登录，接收 multipart 文件 "file"。若配置了 OSS 则上传到阿里云 OSS，否则保存到本地，返回可访问 URL
func UploadImage() gin.HandlerFunc {
	return func(c *gin.Context) {
		_, ok := c.Get(middleware.UserIDKey)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
			return
		}

		file, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "缺少文件或字段名应为 file"})
			return
		}
		if file.Size > maxUploadSize {
			c.JSON(http.StatusBadRequest, gin.H{"error": "文件大小不能超过 10MB"})
			return
		}

		f, err := file.Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "无法读取文件"})
			return
		}
		defer f.Close()

		buf := make([]byte, 512)
		n, err := f.Read(buf)
		if err != nil && err != io.EOF {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "无法读取文件类型"})
			return
		}
		buf = buf[:n]
		contentType := http.DetectContentType(buf)
		if !allowedImageTypes[contentType] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "仅支持图片：JPEG、PNG、GIF、WebP"})
			return
		}

		ext := strings.ToLower(filepath.Ext(file.Filename))
		if ext == "" {
			ext = ".jpg"
		}
		objectName := fmt.Sprintf("uploads/%s/%s%s", time.Now().Format("20060102"), uuid.New().String(), ext)

		if config.UseOSS() {
			url, err := uploadToOSS(f, file.Size, buf, contentType, objectName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"url": url, "path": objectName})
			return
		}

		// 本地保存
		uploadDir := config.UploadDir()
		if err := os.MkdirAll(uploadDir, 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "创建上传目录失败"})
			return
		}
		subDir := time.Now().Format("20060102")
		dir := filepath.Join(uploadDir, subDir)
		if err := os.MkdirAll(dir, 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "创建日期目录失败"})
			return
		}
		name := filepath.Base(objectName)
		dst := filepath.Join(dir, name)

		if err := c.SaveUploadedFile(file, dst); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "保存文件失败"})
			return
		}

		urlPath := "/uploads/" + subDir + "/" + name
		url := config.UploadURLPrefix() + urlPath
		c.JSON(http.StatusOK, gin.H{"url": url, "path": urlPath})
	}
}

// uploadToOSS 将文件内容上传到阿里云 OSS，返回公网可访问 URL。f 已读掉前 512 字节用于类型检测，需传入该前缀 buf 以拼成完整内容
func uploadToOSS(f io.Reader, totalSize int64, prefix512 []byte, contentType, objectName string) (string, error) {
	endpoint := config.OSSEndpoint()
	bucketName := config.OSSBucket()
	cfg := config.Cfg
	if cfg == nil || cfg.Oss.AccessKeyID == "" || cfg.Oss.AccessKeySecret == "" {
		return "", fmt.Errorf("OSS 未配置 AccessKey")
	}

	client, err := oss.New(endpoint, cfg.Oss.AccessKeyID, cfg.Oss.AccessKeySecret)
	if err != nil {
		return "", fmt.Errorf("创建 OSS 客户端失败: %w", err)
	}

	bucket, err := client.Bucket(bucketName)
	if err != nil {
		return "", fmt.Errorf("获取 Bucket 失败: %w", err)
	}

	// 拼成完整 Reader：可能已从 f 读了 512 字节，需与剩余部分一起上传
	var body io.Reader
	if len(prefix512) > 0 {
		rest, err := io.ReadAll(f)
		if err != nil {
			return "", fmt.Errorf("读取文件失败: %w", err)
		}
		body = io.MultiReader(bytes.NewReader(prefix512), bytes.NewReader(rest))
	} else {
		body = f
	}

	options := []oss.Option{
		oss.ContentType(contentType),
		oss.ContentLength(totalSize),
	}
	if err := bucket.PutObject(objectName, body, options...); err != nil {
		return "", fmt.Errorf("上传 OSS 失败: %w", err)
	}

	urlPrefix := config.OSSURLPrefix()
	if urlPrefix == "" {
		urlPrefix = "https://" + bucketName + "." + strings.TrimPrefix(strings.TrimPrefix(endpoint, "https://"), "http://")
	}
	return urlPrefix + "/" + objectName, nil
}
