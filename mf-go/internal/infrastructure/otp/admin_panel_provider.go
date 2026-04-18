package otp

import (
	"context"
	"log/slog"

	"github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/model"
)

// AdminPanelProvider is the initial DeliveryProvider implementation.
// It does not send the code anywhere externally; the code is visible
// to admins via the admin GraphQL queries (adminPendingOTPs, adminUserOTPHistory).
// This is the default provider until WhatsApp/Telegram/Email/SMS providers are wired.
type AdminPanelProvider struct {
	log *slog.Logger
}

func NewAdminPanelProvider(log *slog.Logger) *AdminPanelProvider {
	return &AdminPanelProvider{log: log}
}

func (p *AdminPanelProvider) Channel() model.OTPChannel {
	return model.OTPChannelAdminPanel
}

func (p *AdminPanelProvider) StorageChannel(_ context.Context, _ model.OTPPurpose) model.OTPChannel {
	return p.Channel()
}

func (p *AdminPanelProvider) Send(_ context.Context, userID string, _ string, purpose model.OTPPurpose) error {
	p.log.Info("OTP generated (admin panel delivery)",
		slog.String("user_id", userID),
		slog.String("purpose", string(purpose)),
	)
	return nil
}
