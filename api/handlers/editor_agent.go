package handlers

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/cloudwego/eino/adk"
	openai "github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/schema"

	"inkmind/api/config"
)

// chatCompletionViaAgent 使用 Eino ChatModelAgent，与阅读助手同源模型配置，用于「对话编辑」optimize 链路（须首条为 system）。
func chatCompletionViaAgent(ctx context.Context, oa []openAIMsg) (string, error) {
	if len(oa) == 0 {
		return "", fmt.Errorf("empty messages")
	}
	if strings.ToLower(strings.TrimSpace(oa[0].Role)) != "system" {
		return "", fmt.Errorf("首条消息须为 system")
	}
	instruction := strings.TrimSpace(oa[0].Content)
	if instruction == "" {
		return "", fmt.Errorf("system 指令为空")
	}
	var adkMsgs []adk.Message
	for _, m := range oa[1:] {
		role := strings.ToLower(strings.TrimSpace(m.Role))
		c := m.Content
		if strings.TrimSpace(c) == "" {
			continue
		}
		switch role {
		case "user":
			adkMsgs = append(adkMsgs, schema.UserMessage(c))
		case "assistant":
			adkMsgs = append(adkMsgs, schema.AssistantMessage(c, nil))
		}
	}
	if len(adkMsgs) == 0 {
		return "", fmt.Errorf("没有有效的对话内容")
	}
	cm, err := newEditorAgentChatModel(ctx)
	if err != nil {
		return "", err
	}
	agent, err := adk.NewChatModelAgent(ctx, &adk.ChatModelAgentConfig{
		Name:          "inkmind_editor_assistant",
		Description:   "帮助编辑 InkMind Markdown 博客：按对话修改正文，并遵守约定的输出格式（含 ---OPTIMIZED--- 等标记行）。",
		Instruction:   instruction,
		Model:         cm,
		MaxIterations: 4,
	})
	if err != nil {
		return "", err
	}
	runner := adk.NewRunner(ctx, adk.RunnerConfig{Agent: agent, EnableStreaming: false})
	iter := runner.Run(ctx, adkMsgs)
	return collectChatModelAgentReply(iter)
}

// newEditorAgentChatModel 与阅读助手共用 OpenAI 兼容配置，温度略高以适配改写多样性。
func newEditorAgentChatModel(ctx context.Context) (*openai.ChatModel, error) {
	if !config.AIEnabled() {
		return nil, fmt.Errorf("AI 未配置：请在 config 中启用 ai 并设置 baseURL、apiKey")
	}
	base := config.AIBaseURL()
	if base == "" {
		return nil, fmt.Errorf("AI 未配置：baseURL 为空")
	}
	temp := float32(0.5)
	return openai.NewChatModel(ctx, &openai.ChatModelConfig{
		APIKey:      strings.TrimSpace(config.Cfg.Ai.APIKey),
		BaseURL:     base,
		Model:       config.AIModel(),
		Temperature: &temp,
		Timeout:     120 * time.Second,
	})
}

// newEditorAgentStreamIterator 首条须为 system；流式 Runner，供写作助手 SSE。
func newEditorAgentStreamIterator(ctx context.Context, oa []openAIMsg) (*adk.AsyncIterator[*adk.AgentEvent], error) {
	if len(oa) == 0 {
		return nil, fmt.Errorf("empty messages")
	}
	if strings.ToLower(strings.TrimSpace(oa[0].Role)) != "system" {
		return nil, fmt.Errorf("首条消息须为 system")
	}
	instruction := strings.TrimSpace(oa[0].Content)
	if instruction == "" {
		return nil, fmt.Errorf("system 指令为空")
	}
	var adkMsgs []adk.Message
	for _, m := range oa[1:] {
		role := strings.ToLower(strings.TrimSpace(m.Role))
		c := m.Content
		if strings.TrimSpace(c) == "" {
			continue
		}
		switch role {
		case "user":
			adkMsgs = append(adkMsgs, schema.UserMessage(c))
		case "assistant":
			adkMsgs = append(adkMsgs, schema.AssistantMessage(c, nil))
		}
	}
	if len(adkMsgs) == 0 {
		return nil, fmt.Errorf("没有有效的对话内容")
	}
	cm, err := newEditorAgentChatModel(ctx)
	if err != nil {
		return nil, err
	}
	agent, err := adk.NewChatModelAgent(ctx, &adk.ChatModelAgentConfig{
		Name:          "inkmind_editor_assistant",
		Description:   "帮助编辑 InkMind Markdown 博客：按对话修改正文，并遵守约定的输出格式（含 ---OPTIMIZED--- 等标记行）。",
		Instruction:   instruction,
		Model:         cm,
		MaxIterations: 4,
	})
	if err != nil {
		return nil, err
	}
	runner := adk.NewRunner(ctx, adk.RunnerConfig{Agent: agent, EnableStreaming: true})
	return runner.Run(ctx, adkMsgs), nil
}
