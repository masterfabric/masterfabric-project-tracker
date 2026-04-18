package otp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/model"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/config"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// TelegramDeliveryProvider sends OTP via Telegram Bot API (sendMessage).
// Users must set telegramChatId on their profile (from @userinfobot or your bot webhook).
type TelegramDeliveryProvider struct {
	log    *slog.Logger
	users  repository.UserRepository
	cfg    config.TelegramConfig
	client *http.Client
	brand  string
}

// NewTelegramDeliveryProvider constructs a Telegram Bot API sender.
func NewTelegramDeliveryProvider(log *slog.Logger, users repository.UserRepository, cfg config.TelegramConfig, appName string) *TelegramDeliveryProvider {
	if appName == "" {
		appName = "MasterFabric"
	}
	return &TelegramDeliveryProvider{
		log:   log,
		users: users,
		cfg:   cfg,
		client: &http.Client{
			Timeout: 45 * time.Second,
		},
		brand: appName,
	}
}

func (p *TelegramDeliveryProvider) Channel() model.OTPChannel {
	return model.OTPChannelTelegram
}

func (p *TelegramDeliveryProvider) StorageChannel(_ context.Context, _ model.OTPPurpose) model.OTPChannel {
	return p.Channel()
}

func (p *TelegramDeliveryProvider) Send(ctx context.Context, userID string, code string, purpose model.OTPPurpose) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return domainErr.ErrTokenInvalid
	}
	user, err := p.users.FindByID(ctx, uid)
	if err != nil || user == nil {
		return domainErr.ErrUserNotFound
	}
	chatID := strings.TrimSpace(user.TelegramChatID)
	if chatID == "" {
		return domainErr.ErrOTPNoTelegramChat
	}

	text := fmt.Sprintf("%s — verification code: %s\n\n%s\n(Expires in a few minutes.)",
		p.brand, code, purposeHuman(purpose))

	if err := p.sendMessage(ctx, chatID, text); err != nil {
		p.log.Error("otp telegram api failed",
			slog.String("user_id", userID),
			slog.String("purpose", string(purpose)),
			slog.Any("error", err),
		)
		return domainErr.New("OTP_TELEGRAM_FAILED", "we could not send the Telegram message. Please try again later.", err)
	}

	p.log.Info("otp telegram sent", slog.String("user_id", userID), slog.String("purpose", string(purpose)))
	return nil
}

type tgSendMessageReq struct {
	ChatID string `json:"chat_id"`
	Text   string `json:"text"`
}

type tgAPIResponse struct {
	OK          bool            `json:"ok"`
	Description string          `json:"description"`
	Result      json.RawMessage `json:"result"`
}

func (p *TelegramDeliveryProvider) sendMessage(ctx context.Context, chatID, text string) error {
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", p.cfg.BotToken)
	pl := tgSendMessageReq{ChatID: chatID, Text: text}
	raw, err := json.Marshal(pl)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := p.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))

	var wrap tgAPIResponse
	if err := json.Unmarshal(respBody, &wrap); err != nil {
		return fmt.Errorf("telegram response: %w", err)
	}
	if !wrap.OK {
		return fmt.Errorf("telegram api: %s", wrap.Description)
	}
	return nil
}
