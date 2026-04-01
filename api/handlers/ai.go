package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"

	"inkmind/api/config"
)

const (
	markerOptimized = "---OPTIMIZED---"
	markerBenefits  = "---BENEFITS---"

	maxOptimizeParseAttempts = 3
	// 重试时附带上一条 assistant，控制长度避免撑爆上下文（按 rune 截断）
	maxRepairAssistantRunes = 4000
)

// AiChatRequest 前端对话请求（OpenAI 兼容 messages）
type AiChatRequest struct {
	Messages []struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	} `json:"messages"`
	SelectedExcerpt string `json:"selected_excerpt"`
}

type openAIChatReq struct {
	Model       string      `json:"model"`
	Messages    []openAIMsg `json:"messages"`
	Temperature float64     `json:"temperature,omitempty"`
}

type openAIMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIChatResp struct {
	Choices []struct {
		Message openAIMsg `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error"`
}

// AiOptimizeRequest 按对话处理正文（instruction 为用户在对话中的具体要求，可空则做通顺、结构清晰的通用修改）
type AiOptimizeRequest struct {
	Text        string `json:"text"`
	Instruction string `json:"instruction"`
}

// optimizeSystemContent 与多轮会话共用（响应 JSON 字段名仍为 optimized/benefits，兼容前端）
const optimizeSystemContent = "你是专业 Markdown 博客编辑。你必须根据用户在对话中提出的要求对正文进行修改、改写、扩写、缩写或调整语气；若当前没有正文，则按对话要求生成可直接粘贴的 Markdown、或给出清晰答复，仍须遵守两区块输出格式。若用户未细说且已有正文，则做通顺、结构清晰的通用处理。只输出要求的两个区块，不要前言、结语、解释性段落或 Markdown 代码围栏包裹全文。"

// buildOptimizeUserPrompt 构造单轮/多轮中每一轮发给模型的 user 内容（与历史 assistant 格式一致）。text 与 instruction 均为空时返回空字符串。
func buildOptimizeUserPrompt(text, instruction string) string {
	text = strings.TrimSpace(text)
	ins := strings.TrimSpace(instruction)
	if text == "" && ins == "" {
		return ""
	}

	var lead strings.Builder
	if text == "" {
		lead.WriteString("【用户在对话中的要求】\n")
		lead.WriteString(ins)
		lead.WriteString("\n\n当前编辑器内尚未提供正文。请根据上述要求，在 ---OPTIMIZED--- 中给出可直接使用的 Markdown 正文、大纲或分步说明；若更适合问答式回答，仍将主要内容放在 ---OPTIMIZED--- 中。\n\n")
	} else {
		if ins != "" {
			lead.WriteString("【用户在对话中的要求】\n")
			lead.WriteString(ins)
			lead.WriteString("\n\n请严格按上述要求处理下面正文。\n\n")
		} else {
			lead.WriteString("用户未在对话中说明具体要求，请对下列正文做通顺、结构清晰的修改（可适当润色）。\n\n")
		}
	}
	lead.WriteString(fmt.Sprintf(
		"输出必须严格且仅包含以下结构（两行标记字面出现）：\n%s\n（此处接修改后的完整正文，可直接替换原文）\n%s\n（此处接 2～4 行要点，每行以 \"- \" 开头，简体中文，说明「做了哪些修改」和「对读者的帮助」，不要其它字）\n\n---原文开始---\n%s\n---原文结束---",
		markerOptimized, markerBenefits, text,
	))
	return lead.String()
}

func chatCompletion(ctx context.Context, messages []openAIMsg) (string, error) {
	if !config.AIEnabled() {
		return "", fmt.Errorf("AI 未配置：请在 config 中启用 ai 并设置 baseURL、apiKey")
	}
	payload := openAIChatReq{
		Model:       config.AIModel(),
		Messages:    messages,
		Temperature: 0.5,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, config.AIChatEndpoint(), bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+strings.TrimSpace(config.Cfg.Ai.APIKey))
	if r := strings.TrimSpace(config.Cfg.Ai.Referer); r != "" {
		httpReq.Header["HTTP-Referer"] = []string{r}
	}
	if t := strings.TrimSpace(config.Cfg.Ai.Title); t != "" {
		httpReq.Header["X-Title"] = []string{t}
		httpReq.Header["X-OpenRouter-Title"] = []string{t}
	}
	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	var out openAIChatResp
	if err := json.Unmarshal(respBody, &out); err != nil {
		return "", fmt.Errorf("解析 AI 响应失败: %s", truncate(string(respBody), 200))
	}
	if out.Error != nil && out.Error.Message != "" {
		return "", fmt.Errorf("%s", out.Error.Message)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("AI 接口 HTTP %d: %s", resp.StatusCode, truncate(string(respBody), 300))
	}
	if len(out.Choices) == 0 || strings.TrimSpace(out.Choices[0].Message.Content) == "" {
		return "", fmt.Errorf("AI 返回内容为空")
	}
	return strings.TrimSpace(out.Choices[0].Message.Content), nil
}

func truncateStringRunes(s string, maxRunes int) string {
	if utf8.RuneCountInString(s) <= maxRunes {
		return s
	}
	r := []rune(s)
	return string(r[:maxRunes]) + "\n…（已截断）"
}

func repairFormatUserMessage() string {
	return "你上一条输出未满足约定：必须严格包含两行字面量标记 " + markerOptimized + " 与 " + markerBenefits +
		"（各独占一行），且 " + markerBenefits + " 必须出现在正文之后、" + markerOptimized + " 之后。请重新输出完整内容，不要省略任一标记，不要改标记文字，不要只用标题代替 " + markerBenefits + " 区块。"
}

// chatCompletionOptimizeWithRetry 通过 Eino ChatModelAgent（见 editor_agent.go）调用模型，解析失败时自动重试（追加格式修复追问），成功返回正文与要点。
func chatCompletionOptimizeWithRetry(ctx context.Context, initial []openAIMsg) (optimized, benefits string, err error) {
	msgs := append([]openAIMsg(nil), initial...)
	var lastParseErr error
	var lastRaw string
	for attempt := 0; attempt < maxOptimizeParseAttempts; attempt++ {
		raw, cerr := chatCompletionViaAgent(ctx, msgs)
		if cerr != nil {
			return "", "", cerr
		}
		lastRaw = raw
		opt, ben, perr := parseOptimizeOutput(raw)
		if perr == nil {
			return opt, ben, nil
		}
		lastParseErr = perr
		if attempt == maxOptimizeParseAttempts-1 {
			break
		}
		msgs = append(msgs, openAIMsg{Role: "assistant", Content: truncateStringRunes(raw, maxRepairAssistantRunes)})
		msgs = append(msgs, openAIMsg{Role: "user", Content: repairFormatUserMessage()})
	}
	if lastParseErr != nil {
		return "", "", fmt.Errorf("%s；原始片段：%s", lastParseErr.Error(), truncate(lastRaw, 120))
	}
	return "", "", fmt.Errorf("模型未按约定格式返回")
}

// AiChat 调用 OpenAI 兼容 /v1/chat/completions（保留兼容）
func AiChat() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AiChatRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的 JSON 请求体"})
			return
		}
		if len(req.Messages) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "messages 不能为空"})
			return
		}
		msgs := []openAIMsg{
			{
				Role:    "system",
				Content: "你是 InkMind 个人博客的写作助手。请用简体中文回答，帮助用户润色、扩写、缩写、改语气、解释概念或回答与写作相关的问题。若用户提供了选中的正文片段，请结合该片段作答。",
			},
		}
		if ex := strings.TrimSpace(req.SelectedExcerpt); ex != "" {
			msgs = append(msgs, openAIMsg{
				Role:    "user",
				Content: "以下是我从文章中选中的片段，请在回答时结合该片段：\n---\n" + ex + "\n---",
			})
		}
		for _, m := range req.Messages {
			role := strings.ToLower(strings.TrimSpace(m.Role))
			if role != "user" && role != "assistant" {
				continue
			}
			if strings.TrimSpace(m.Content) == "" {
				continue
			}
			msgs = append(msgs, openAIMsg{Role: role, Content: m.Content})
		}
		if len(msgs) <= 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "没有有效的对话内容"})
			return
		}
		reply, err := chatCompletion(c.Request.Context(), msgs)
		if err != nil {
			if strings.Contains(err.Error(), "AI 未配置") {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"reply": reply})
	}
}

// AiOptimize 按对话处理 Markdown 正文，返回修改结果 + 说明（固定分隔符解析；JSON 键名仍为 optimized/benefits）
func AiOptimize() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AiOptimizeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的 JSON 请求体"})
			return
		}
		userPrompt := buildOptimizeUserPrompt(req.Text, req.Instruction)
		if userPrompt == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请提供正文，或在对话中说明你的要求"})
			return
		}

		msgs := []openAIMsg{
			{Role: "system", Content: optimizeSystemContent},
			{Role: "user", Content: userPrompt},
		}

		opt, ben, err := chatCompletionOptimizeWithRetry(c.Request.Context(), msgs)
		if err != nil {
			if strings.Contains(err.Error(), "AI 未配置") {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"optimized": opt, "benefits": ben})
	}
}

func parseOptimizeOutput(raw string) (optimized, benefits string, err error) {
	s := strings.TrimSpace(raw)
	// 去掉可能的 ``` 包裹
	if strings.HasPrefix(s, "```") {
		if idx := strings.Index(s[3:], "```"); idx >= 0 {
			s = strings.TrimSpace(s[3 : 3+idx])
		}
	}
	i := strings.Index(s, markerOptimized)
	j := strings.Index(s, markerBenefits)
	if i < 0 || j < 0 || j <= i {
		return "", "", fmt.Errorf("模型未按约定格式返回（需包含 %s 与 %s）", markerOptimized, markerBenefits)
	}
	optimized = strings.TrimSpace(s[i+len(markerOptimized) : j])
	benefits = strings.TrimSpace(s[j+len(markerBenefits):])
	if optimized == "" {
		return "", "", fmt.Errorf("修改后的正文为空")
	}
	return optimized, benefits, nil
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}
