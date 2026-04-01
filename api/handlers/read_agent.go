package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"runtime/debug"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/cloudwego/eino/adk"
	openai "github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/schema"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"inkmind/api/config"
	"inkmind/api/middleware"
	"inkmind/api/models"
)

const readAgentArticleMaxRunes = 12000

// readAgentStart 校验请求并启动 Runner；失败时已写入 JSON 响应，返回 ok=false。
func readAgentStart(c *gin.Context, db *gorm.DB, enableStreaming bool) (iter *adk.AsyncIterator[*adk.AgentEvent], ok bool) {
	uidVal, ok := c.Get(middleware.UserIDKey)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return nil, false
	}
	userID, ok := uidVal.(uint)
	if !ok {
		log.Printf("[read-agent] bad user_id type: %T value=%v", uidVal, uidVal)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "会话异常"})
		return nil, false
	}

	var body struct {
		ArticleID uint `json:"article_id" binding:"required"`
		Messages  []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"messages" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		log.Printf("[read-agent] bind json: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的 JSON 请求体"})
		return nil, false
	}
	if len(body.Messages) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "messages 不能为空"})
		return nil, false
	}
	log.Printf("[read-agent] start article_id=%d user_id=%d raw_messages=%d stream=%v", body.ArticleID, userID, len(body.Messages), enableStreaming)

	var art models.Article
	if err := db.First(&art, body.ArticleID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "文章不存在"})
			return nil, false
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return nil, false
	}
	if art.Status != "published" && art.AuthorID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权在阅读助手中使用该文章"})
		return nil, false
	}

	ctx := c.Request.Context()
	log.Printf("[read-agent] building ChatModel baseURL=%q model=%q", config.AIBaseURL(), config.AIModel())
	cm, err := newReadAgentChatModel(ctx)
	if err != nil {
		log.Printf("[read-agent] newReadAgentChatModel: %v", err)
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
		return nil, false
	}
	log.Printf("[read-agent] ChatModel ok")

	instruction := buildReadAgentInstruction(art.Title, art.Body)
	log.Printf("[read-agent] instruction_len=%d runes(body)=%d", len(instruction), utf8.RuneCountInString(art.Body))
	agent, err := adk.NewChatModelAgent(ctx, &adk.ChatModelAgentConfig{
		Name:          "inkmind_read_assistant",
		Description:   "在阅读 InkMind 博客文章时帮助读者理解内容、答疑与摘要，不修改正文。",
		Instruction:   instruction,
		Model:         cm,
		MaxIterations: 4,
	})
	if err != nil {
		log.Printf("[read-agent] NewChatModelAgent: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return nil, false
	}
	log.Printf("[read-agent] NewChatModelAgent ok")

	var adkMsgs []adk.Message
	for _, m := range body.Messages {
		r := strings.ToLower(strings.TrimSpace(m.Role))
		cstr := strings.TrimSpace(m.Content)
		if cstr == "" {
			continue
		}
		switch r {
		case "user":
			adkMsgs = append(adkMsgs, schema.UserMessage(cstr))
		case "assistant":
			adkMsgs = append(adkMsgs, schema.AssistantMessage(cstr, nil))
		}
	}
	if len(adkMsgs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "没有有效的对话内容"})
		return nil, false
	}
	log.Printf("[read-agent] adk_msgs=%d", len(adkMsgs))

	runner := adk.NewRunner(ctx, adk.RunnerConfig{Agent: agent, EnableStreaming: enableStreaming})
	log.Printf("[read-agent] runner.Run …")
	return runner.Run(ctx, adkMsgs), true
}

// ReadAgentChat 阅读场景专用：Eino ChatModelAgent，与 /api/ai/* 写作链路完全分离
func ReadAgentChat(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[read-agent] PANIC: %v\n%s", r, debug.Stack())
				if !c.Writer.Written() {
					c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
						"error":  "阅读助手内部错误（已记录日志）",
						"detail": fmt.Sprintf("%v", r),
					})
				}
			}
		}()

		iter, ok := readAgentStart(c, db, false)
		if !ok {
			return
		}
		reply, err := collectChatModelAgentReply(iter)
		if err != nil {
			log.Printf("[read-agent] collectChatModelAgentReply: %v", err)
			if strings.Contains(err.Error(), "AI 未配置") {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		log.Printf("[read-agent] success reply_len=%d", len(reply))
		c.JSON(http.StatusOK, gin.H{"reply": reply})
	}
}

// ReadAgentChatStream 与 ReadAgentChat 同源，以 SSE 推送正文分片（data: JSON），便于前端打字机展示。
// 事件：{"delta":"..."} 多次；结束时 {"done":true}；失败 {"error":"..."}。
func ReadAgentChatStream(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[read-agent-stream] PANIC: %v\n%s", r, debug.Stack())
				if !c.Writer.Written() {
					c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
						"error":  "阅读助手内部错误（已记录日志）",
						"detail": fmt.Sprintf("%v", r),
					})
				}
			}
		}()

		iter, ok := readAgentStart(c, db, true)
		if !ok {
			return
		}
		if err := streamReadAgentSSE(c, iter); err != nil {
			log.Printf("[read-agent-stream] %v", err)
			if !c.Writer.Written() {
				if strings.Contains(err.Error(), "AI 未配置") {
					c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
					return
				}
				if strings.Contains(err.Error(), "不支持流式") {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			}
		}
	}
}

func streamReadAgentSSE(c *gin.Context, iter *adk.AsyncIterator[*adk.AgentEvent]) error {
	w := c.Writer
	h := w.Header()
	h.Set("Content-Type", "text/event-stream; charset=utf-8")
	h.Set("Cache-Control", "no-cache")
	h.Set("Connection", "keep-alive")
	h.Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		return fmt.Errorf("响应不支持流式输出")
	}

	writeData := func(v map[string]any) error {
		b, err := json.Marshal(v)
		if err != nil {
			return err
		}
		if _, err := fmt.Fprintf(w, "data: %s\n\n", b); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}

	w.WriteHeader(http.StatusOK)

	var wrote bool
	for {
		ev, ok := iter.Next()
		if !ok {
			break
		}
		if ev.Err != nil {
			_ = writeData(map[string]any{"error": ev.Err.Error()})
			return ev.Err
		}
		if ev.Output == nil || ev.Output.MessageOutput == nil {
			continue
		}
		n, err := writeMessageVariantSSE(writeData, ev.Output.MessageOutput, nil)
		if err != nil {
			_ = writeData(map[string]any{"error": err.Error()})
			return err
		}
		if n > 0 {
			wrote = true
		}
	}
	if !wrote {
		_ = writeData(map[string]any{"error": "阅读助手未返回有效内容"})
		return fmt.Errorf("阅读助手未返回有效内容")
	}
	return writeData(map[string]any{"done": true})
}

// acc 非 nil 时同时拼接完整模型输出（用于写作助手流式结束后再解析 ---OPTIMIZED---）。
func writeMessageVariantSSE(writeData func(map[string]any) error, mv *adk.MessageVariant, acc *strings.Builder) (chunks int, err error) {
	if mv == nil {
		return 0, nil
	}
	if mv.IsStreaming && mv.MessageStream != nil {
		defer mv.MessageStream.Close()
		for {
			chunk, err := mv.MessageStream.Recv()
			if err == io.EOF {
				break
			}
			if err != nil {
				return chunks, err
			}
			if chunk == nil {
				continue
			}
			delta := deltaFromMessageChunk(chunk)
			if delta == "" {
				continue
			}
			if acc != nil {
				acc.WriteString(delta)
			}
			if err := writeData(map[string]any{"delta": delta}); err != nil {
				return chunks, err
			}
			chunks++
		}
		return chunks, nil
	}
	msg := mv.Message
	if msg == nil {
		msg, err = mv.GetMessage()
		if err != nil {
			return 0, err
		}
	}
	if msg == nil {
		return 0, nil
	}
	content := strings.TrimSpace(deltaFromMessageChunk(msg))
	if content == "" {
		return 0, nil
	}
	if acc != nil {
		acc.WriteString(content)
	}
	if err := writeData(map[string]any{"delta": content}); err != nil {
		return 0, err
	}
	return 1, nil
}

// deltaFromMessageChunk 从流式分片中取可展示文本（部分模型把增量放在 AssistantGenMultiContent）。
func deltaFromMessageChunk(m *schema.Message) string {
	if m == nil {
		return ""
	}
	var b strings.Builder
	b.WriteString(m.Content)
	if m.ReasoningContent != "" {
		b.WriteString(m.ReasoningContent)
	}
	for _, p := range m.AssistantGenMultiContent {
		if p.Type == schema.ChatMessagePartTypeText || p.Type == "" {
			b.WriteString(p.Text)
		}
	}
	for _, p := range m.MultiContent {
		if p.Type == schema.ChatMessagePartTypeText || p.Type == "" {
			b.WriteString(p.Text)
		}
	}
	return b.String()
}

func newReadAgentChatModel(ctx context.Context) (*openai.ChatModel, error) {
	if !config.AIEnabled() {
		return nil, fmt.Errorf("AI 未配置：请在 config 中启用 ai 并设置 baseURL、apiKey")
	}
	base := config.AIBaseURL()
	if base == "" {
		return nil, fmt.Errorf("AI 未配置：baseURL 为空")
	}
	temp := float32(0.45)
	return openai.NewChatModel(ctx, &openai.ChatModelConfig{
		APIKey:      strings.TrimSpace(config.Cfg.Ai.APIKey),
		BaseURL:     base,
		Model:       config.AIModel(),
		Temperature: &temp,
		Timeout:     120 * time.Second,
	})
}

func buildReadAgentInstruction(title, body string) string {
	b := strings.TrimSpace(body)
	if utf8.RuneCountInString(b) > readAgentArticleMaxRunes {
		r := []rune(b)
		b = string(r[:readAgentArticleMaxRunes]) + "\n\n…（正文已截断，仅用于阅读辅助）"
	}
	return "你是 InkMind 博客的「阅读助手」智能体，只服务读者：帮助理解、概括、解释术语、延伸思考。不要代替作者改写正文，不要输出「替换成如下 Markdown」类编辑建议。\n\n" +
		"当前文章标题：" + strings.TrimSpace(title) + "\n\n正文（Markdown）：\n---\n" + b + "\n---\n"
}

// collectChatModelAgentReply 聚合 Eino ChatModelAgent 非流式最终文本（阅读助手 / 写作助手共用）。
func collectChatModelAgentReply(iter *adk.AsyncIterator[*adk.AgentEvent]) (string, error) {
	var parts []string
	n := 0
	for {
		ev, ok := iter.Next()
		if !ok {
			log.Printf("[chat-model-agent] iterator done events=%d parts=%d", n, len(parts))
			break
		}
		n++
		if ev.Err != nil {
			log.Printf("[chat-model-agent] event #%d err: %v", n, ev.Err)
			return "", ev.Err
		}
		if ev.Output == nil || ev.Output.MessageOutput == nil {
			log.Printf("[chat-model-agent] event #%d no message output (agent=%q)", n, ev.AgentName)
			continue
		}
		msg, err := ev.Output.MessageOutput.GetMessage()
		if err != nil {
			log.Printf("[chat-model-agent] event #%d GetMessage: %v", n, err)
			continue
		}
		if msg == nil {
			log.Printf("[chat-model-agent] event #%d msg=nil", n)
			continue
		}
		c := strings.TrimSpace(msg.Content)
		if c != "" {
			parts = append(parts, c)
		}
	}
	if len(parts) == 0 {
		return "", fmt.Errorf("模型未返回有效内容")
	}
	return strings.Join(parts, "\n"), nil
}
