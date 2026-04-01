package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

const (
	EnvDev  = "dev"
	EnvTest = "test"
	EnvProd = "prod"
)

// Config 根配置，与 config.*.yaml 结构一致
type Config struct {
	App      AppConfig      `yaml:"app"`
	Server   ServerConfig   `yaml:"server"`
	Database DatabaseConfig `yaml:"database"`
	Jwt      JwtConfig      `yaml:"jwt"`
	Upload   UploadConfig   `yaml:"upload"`
	Oss      OssConfig      `yaml:"oss"`
	Ai       AiConfig       `yaml:"ai"`
}

// AiConfig OpenAI 兼容接口（POST {baseURL}/chat/completions）
// 阿里云通义千问：baseURL 一般为 https://dashscope.aliyuncs.com/compatible-mode/v1 ，密钥 ${DASHSCOPE_API_KEY}
type AiConfig struct {
	Enabled bool   `yaml:"enabled"`
	BaseURL string `yaml:"baseURL"`
	APIKey  string `yaml:"apiKey"`
	Model   string `yaml:"model"`
	// Referer、Title：部分网关（如 OpenRouter）可选；通义千问可不填
	Referer string `yaml:"referer"`
	Title   string `yaml:"title"`
}

// UploadConfig 图片上传：本地目录与 URL 前缀（未配置 OSS 时使用）
type UploadConfig struct {
	Dir       string `yaml:"dir"`       // 本地目录，如 ./uploads
	URLPrefix string `yaml:"urlPrefix"`  // 返回给前端的 URL 前缀
}

// OssConfig 阿里云 OSS 配置（配置后图片上传到 OSS）
type OssConfig struct {
	Endpoint        string `yaml:"endpoint"`        // 如 oss-cn-hangzhou.aliyuncs.com
	AccessKeyID     string `yaml:"accessKeyId"`
	AccessKeySecret string `yaml:"accessKeySecret"`
	BucketName      string `yaml:"bucketName"`
	URLPrefix       string `yaml:"urlPrefix"`       // 公网访问前缀，如 https://bucket.oss-cn-hangzhou.aliyuncs.com
}

type JwtConfig struct {
	Secret       string `yaml:"secret"`
	AccessExpiry string `yaml:"accessExpiry"` // e.g. 12h, 24h
	Issuer       string `yaml:"issuer"`
}

type AppConfig struct {
	Name           string `yaml:"name"`
	Debug          bool   `yaml:"debug"`
	Env            string `yaml:"env"`
	LogLevel       string `yaml:"logLevel"`
	ShowStacktrace bool   `yaml:"showStacktrace"`
}

type ServerConfig struct {
	Port         string `yaml:"port"`
	Timeout      string `yaml:"timeout"`
	RouterPrefix string `yaml:"routerPrefix"` // 项目路径前缀（不含斜杠），如 inkmind；空则 API 挂在 /api
}

type DatabaseConfig struct {
	Driver          string `yaml:"driver"`
	Host            string `yaml:"host"`
	Port            string `yaml:"port"`
	Username        string `yaml:"username"`
	Password        string `yaml:"password"`
	Database        string `yaml:"database"`
	Options         string `yaml:"options"`
	MaxOpenConns    int    `yaml:"maxOpenConns"`
	MaxIdleConns    int    `yaml:"maxIdleConns"`
	ConnMaxLifetime string `yaml:"connMaxLifetime"`
	LogQueries      bool   `yaml:"logQueries"`
	SlowQueryTime   int    `yaml:"slowQueryTime"`
}

var Cfg *Config

// Load 根据 APP_ENV 加载对应 YAML 配置文件（config.dev.yaml / config.test.yaml / config.prod.yaml）
func Load() error {
	appEnv := os.Getenv("APP_ENV")
	if appEnv == "" {
		appEnv = EnvDev
	}

	// 配置文件路径：api/config/、config/、当前目录
	fileName := "config." + appEnv + ".yaml"
	names := []string{
		filepath.Join("config", fileName),
		filepath.Join("api", "config", fileName),
		fileName,
	}
	var data []byte
	var err error
	for _, name := range names {
		data, err = os.ReadFile(name)
		if err == nil {
			break
		}
	}
	if err != nil {
		return fmt.Errorf("config: no config file found for APP_ENV=%s: %w", appEnv, err)
	}

	// 展开环境变量 ${VAR_NAME}
	expanded := os.Expand(string(data), func(key string) string {
		return os.Getenv(key)
	})

	var cfg Config
	if err := yaml.Unmarshal([]byte(expanded), &cfg); err != nil {
		return fmt.Errorf("config: parse yaml: %w", err)
	}

	Cfg = &cfg
	return nil
}

func normalizeRouterPrefix(s string) string {
	s = strings.TrimSpace(s)
	return strings.Trim(s, "/")
}

// APIBasePath 返回 Gin 挂载的 API 根路径，如 "/api" 或 "/inkmind/api"
func APIBasePath() string {
	if Cfg == nil {
		return "/api"
	}
	p := normalizeRouterPrefix(Cfg.Server.RouterPrefix)
	if p == "" {
		return "/api"
	}
	return "/" + p + "/api"
}

// ServerAddr 返回监听地址，如 ":10001"
func ServerAddr() string {
	port := Cfg.Server.Port
	if port == "" {
		port = "10001"
	}
	if !strings.HasPrefix(port, ":") {
		port = ":" + port
	}
	return port
}

// DSN 返回 MySQL 连接串
func DSN() string {
	db := &Cfg.Database
	port := db.Port
	if port == "" {
		port = "3306"
	}
	opts := db.Options
	if opts == "" {
		opts = "charset=utf8mb4&parseTime=True&loc=Local"
	}
	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?%s",
		db.Username, db.Password, db.Host, port, db.Database, opts)
}

// DatabasePool 返回连接池配置，用于 database.Connect 后设置
func DatabasePool() (maxOpen, maxIdle int, maxLifetime time.Duration) {
	db := &Cfg.Database
	maxOpen = db.MaxOpenConns
	if maxOpen <= 0 {
		maxOpen = 25
	}
	maxIdle = db.MaxIdleConns
	if maxIdle <= 0 {
		maxIdle = 5
	}
	maxLifetime, _ = time.ParseDuration(db.ConnMaxLifetime)
	if maxLifetime <= 0 {
		maxLifetime = 5 * time.Minute
	}
	return maxOpen, maxIdle, maxLifetime
}

func AppEnv() string {
	if Cfg == nil {
		return EnvDev
	}
	return Cfg.App.Env
}

func IsTest() bool  { return AppEnv() == EnvTest }
func IsProd() bool  { return AppEnv() == EnvProd }
func IsDebug() bool { return Cfg != nil && Cfg.App.Debug }

// JWTSecret 返回 JWT 签名密钥，未配置时开发环境用默认值
func JWTSecret() string {
	if Cfg != nil && Cfg.Jwt.Secret != "" {
		return Cfg.Jwt.Secret
	}
	return "inkmind-dev-secret-change-in-production"
}

// JWTExpiry 返回 access token 有效期
func JWTExpiry() time.Duration {
	if Cfg != nil && Cfg.Jwt.AccessExpiry != "" {
		if d, err := time.ParseDuration(Cfg.Jwt.AccessExpiry); err == nil {
			return d
		}
	}
	return 24 * time.Hour
}
func ServerPort() int {
	if Cfg == nil {
		return 10001
	}
	p, _ := strconv.Atoi(strings.TrimPrefix(Cfg.Server.Port, ":"))
	if p <= 0 {
		return 10001
	}
	return p
}

// UploadDir 返回上传文件保存目录（仅本地模式），未配置时默认 ./uploads
func UploadDir() string {
	if Cfg != nil && Cfg.Upload.Dir != "" {
		return Cfg.Upload.Dir
	}
	return "uploads"
}

// UploadURLPrefix 返回上传文件访问 URL 前缀（仅本地模式）
func UploadURLPrefix() string {
	if Cfg != nil && Cfg.Upload.URLPrefix != "" {
		return strings.TrimSuffix(Cfg.Upload.URLPrefix, "/")
	}
	return "http://localhost" + ServerAddr()
}

// UseOSS 是否使用阿里云 OSS 存储图片
func UseOSS() bool {
	return Cfg != nil && Cfg.Oss.BucketName != "" && Cfg.Oss.AccessKeyID != "" && Cfg.Oss.AccessKeySecret != ""
}

// OSSEndpoint 返回 OSS endpoint（含 scheme）
func OSSEndpoint() string {
	if Cfg == nil || Cfg.Oss.Endpoint == "" {
		return "https://oss-cn-hangzhou.aliyuncs.com"
	}
	e := strings.TrimSpace(Cfg.Oss.Endpoint)
	if !strings.HasPrefix(e, "http") {
		return "https://" + e
	}
	return e
}

// OSSBucket 返回 OSS bucket 名
func OSSBucket() string {
	if Cfg != nil && Cfg.Oss.BucketName != "" {
		return Cfg.Oss.BucketName
	}
	return ""
}

// OSSURLPrefix 返回 OSS 公网访问 URL 前缀（用于返回给前端的图片地址）
func OSSURLPrefix() string {
	if Cfg != nil && Cfg.Oss.URLPrefix != "" {
		return strings.TrimSuffix(Cfg.Oss.URLPrefix, "/")
	}
	return ""
}

// AIEnabled 是否启用 AI 对话（需 enabled、baseURL、apiKey 均有效）
func AIEnabled() bool {
	if Cfg == nil || !Cfg.Ai.Enabled {
		return false
	}
	if strings.TrimSpace(Cfg.Ai.APIKey) == "" {
		return false
	}
	if strings.TrimSpace(Cfg.Ai.BaseURL) == "" {
		return false
	}
	return true
}

// AIBaseURL 返回 OpenAI 兼容 API 根路径（不含 /chat/completions），供 Eino ChatModel 等使用
func AIBaseURL() string {
	if Cfg == nil {
		return ""
	}
	return strings.TrimSuffix(strings.TrimSpace(Cfg.Ai.BaseURL), "/")
}

// AIChatEndpoint 返回 chat completions 完整 URL
func AIChatEndpoint() string {
	base := AIBaseURL()
	if base == "" {
		return ""
	}
	return base + "/chat/completions"
}

// AIModel 返回模型名
func AIModel() string {
	if Cfg != nil && strings.TrimSpace(Cfg.Ai.Model) != "" {
		return strings.TrimSpace(Cfg.Ai.Model)
	}
	return "qwen-plus"
}