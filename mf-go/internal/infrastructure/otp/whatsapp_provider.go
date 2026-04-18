package otp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/model"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/config"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// WhatsAppDeliveryProvider sends OTP via Meta WhatsApp Cloud API (text messages).
// Requires a user phone number on the profile (digits with country code).
// Note: production accounts may need an approved authentication template for cold outreach.
type WhatsAppDeliveryProvider struct {
	log    *slog.Logger
	users  repository.UserRepository
	cfg    config.WhatsAppConfig
	client *http.Client
	brand  string
}

// NewWhatsAppDeliveryProvider constructs a WhatsApp Cloud API sender.
func NewWhatsAppDeliveryProvider(log *slog.Logger, users repository.UserRepository, cfg config.WhatsAppConfig, appName string) *WhatsAppDeliveryProvider {
	if appName == "" {
		appName = "MasterFabric"
	}
	return &WhatsAppDeliveryProvider{
		log:   log,
		users: users,
		cfg:   cfg,
		client: &http.Client{
			Timeout: 45 * time.Second,
		},
		brand: appName,
	}
}

func (p *WhatsAppDeliveryProvider) Channel() model.OTPChannel {
	return model.OTPChannelWhatsApp
}

func (p *WhatsAppDeliveryProvider) StorageChannel(_ context.Context, _ model.OTPPurpose) model.OTPChannel {
	return p.Channel()
}

func (p *WhatsAppDeliveryProvider) Send(ctx context.Context, userID string, code string, purpose model.OTPPurpose) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return domainErr.ErrTokenInvalid
	}
	user, err := p.users.FindByID(ctx, uid)
	if err != nil || user == nil {
		return domainErr.ErrUserNotFound
	}
	to, err := normalizeWhatsAppRecipient(user.PhoneNumber)
	if err != nil || to == "" {
		return domainErr.ErrOTPNoPhoneForWhatsApp
	}

	body := fmt.Sprintf("*%s*\nYour verification code: *%s*\n\n%s\n\nExpires in a few minutes.",
		p.brand, code, purposeHuman(purpose))

	if err := p.sendCloudAPIText(ctx, to, body); err != nil {
		p.log.Error("otp whatsapp api failed",
			slog.String("user_id", userID),
			slog.String("purpose", string(purpose)),
			slog.Any("error", err),
		)
		return domainErr.New("OTP_WHATSAPP_FAILED", "we could not send the WhatsApp message. Please try again later.", err)
	}

	p.log.Info("otp whatsapp sent", slog.String("user_id", userID), slog.String("purpose", string(purpose)))
	return nil
}

type waSendPayload struct {
	MessagingProduct string `json:"messaging_product"`
	To               string `json:"to"`
	Type             string `json:"type"`
	Text             struct {
		PreviewURL bool   `json:"preview_url"`
		Body       string `json:"body"`
	} `json:"text"`
}

func (p *WhatsAppDeliveryProvider) sendCloudAPIText(ctx context.Context, to, text string) error {
	url := fmt.Sprintf("https://graph.facebook.com/%s/%s/messages", p.cfg.APIVersion, p.cfg.PhoneNumberID)
	var pl waSendPayload
	pl.MessagingProduct = "whatsapp"
	pl.To = to
	pl.Type = "text"
	pl.Text.PreviewURL = false
	pl.Text.Body = text

	raw, err := json.Marshal(pl)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+p.cfg.AccessToken)
	req.Header.Set("Content-Type", "application/json")

	res, err := p.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("whatsapp api %d: %s", res.StatusCode, string(respBody))
	}
	return nil
}
