package otp

import (
	"context"
	"log/slog"
	"strings"

	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	mailport "github.com/masterfabric/masterfabric_go_basic/internal/domain/mail/port"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/model"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/provider"
	settingsRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/settings/repository"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/config"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// NewDeliveryProvider selects the OTP delivery implementation from configuration.
// smtpResolver supplies effective SMTP (database admin settings or env fallback) for email delivery.
// appSettings supplies otp_email_* keys (may be nil — treated as defaults).
func NewDeliveryProvider(
	cfg *config.Config,
	log *slog.Logger,
	users repository.UserRepository,
	smtpResolver mailport.SMTPConfigResolver,
	appSettings settingsRepo.AppSettingsRepository,
) provider.DeliveryProvider {
	mode := strings.ToLower(strings.TrimSpace(cfg.OTP.Delivery))
	brand := cfg.OTP.AppName
	admin := NewAdminPanelProvider(log)

	switch mode {
	case "email":
		return NewEmailDeliveryProvider(log, users, smtpResolver, brand, appSettings)
	case "both":
		return newChainOTPProvider(
			NewEmailDeliveryProvider(log, users, smtpResolver, brand, appSettings),
			admin,
			model.OTPChannelEmail,
		)
	case "whatsapp":
		if !cfg.WhatsApp.IsConfigured() {
			log.Warn("OTP_DELIVERY=whatsapp but WhatsApp env is incomplete; using admin_panel")
			return admin
		}
		return NewWhatsAppDeliveryProvider(log, users, cfg.WhatsApp, brand)
	case "whatsapp_both":
		if !cfg.WhatsApp.IsConfigured() {
			log.Warn("OTP_DELIVERY=whatsapp_both but WhatsApp env is incomplete; using admin_panel")
			return admin
		}
		return newChainOTPProvider(
			NewWhatsAppDeliveryProvider(log, users, cfg.WhatsApp, brand),
			admin,
			model.OTPChannelWhatsApp,
		)
	case "telegram":
		if !cfg.Telegram.IsConfigured() {
			log.Warn("OTP_DELIVERY=telegram but TELEGRAM_BOT_TOKEN is missing; using admin_panel")
			return admin
		}
		return NewTelegramDeliveryProvider(log, users, cfg.Telegram, brand)
	case "telegram_both":
		if !cfg.Telegram.IsConfigured() {
			log.Warn("OTP_DELIVERY=telegram_both but TELEGRAM_BOT_TOKEN is missing; using admin_panel")
			return admin
		}
		return newChainOTPProvider(
			NewTelegramDeliveryProvider(log, users, cfg.Telegram, brand),
			admin,
			model.OTPChannelTelegram,
		)
	default:
		return admin
	}
}

// userFacingSMTPPurposes are delivered via email when effective SMTP is configured,
// even if OTP_DELIVERY is admin_panel (same idea as self-serve password reset).
func userFacingSMTPPurpose(p model.OTPPurpose) bool {
	switch p {
	case model.OTPPurposeLogin,
		model.OTPPurposeVerifyIdentity,
		model.OTPPurposePasswordReset,
		model.OTPPurposeAccountActivate,
		model.OTPPurposeEmailChange:
		return true
	default:
		return false
	}
}

// WithUserFacingOTPSMTP wraps base so login, verify_identity, password_reset, and
// account_activate OTPs are sent via SMTP when effective SMTP is configured, even if
// OTP_DELIVERY is admin_panel. Other purposes still use base.
func WithUserFacingOTPSMTP(
	base provider.DeliveryProvider,
	email provider.DeliveryProvider,
	resolver mailport.SMTPConfigResolver,
	log *slog.Logger,
) provider.DeliveryProvider {
	if email == nil || resolver == nil {
		return base
	}
	if log == nil {
		log = slog.Default()
	}
	return &userFacingSMTPBridge{base: base, email: email, resolver: resolver, log: log}
}

// WithPasswordResetPreferSMTP is an alias for WithUserFacingOTPSMTP (historic name).
func WithPasswordResetPreferSMTP(
	base provider.DeliveryProvider,
	email provider.DeliveryProvider,
	resolver mailport.SMTPConfigResolver,
	log *slog.Logger,
) provider.DeliveryProvider {
	return WithUserFacingOTPSMTP(base, email, resolver, log)
}

type userFacingSMTPBridge struct {
	base     provider.DeliveryProvider
	email    provider.DeliveryProvider
	resolver mailport.SMTPConfigResolver
	log      *slog.Logger
}

func (p *userFacingSMTPBridge) Channel() model.OTPChannel {
	return p.base.Channel()
}

// smtpPreferredFor decides when the bridge sends via email even though OTP_DELIVERY is not "email".
// - Admin panel as primary: login / verify_identity / account_activate / password_reset use SMTP when configured.
// - Other primaries (WhatsApp, Telegram, email, both): unchanged except password_reset still may use SMTP
// when configured (self-serve reset), matching the historic WithPasswordResetPreferSMTP behavior.
func (p *userFacingSMTPBridge) smtpPreferredFor(ctx context.Context, purpose model.OTPPurpose) bool {
	smtpCfg, err := p.resolver.Resolve(ctx)
	if err != nil || !smtpCfg.IsConfigured() {
		if err != nil {
			p.log.Warn("otp user-facing: effective SMTP resolve failed, using OTP_DELIVERY channel",
				slog.String("purpose", string(purpose)),
				slog.Any("error", err))
		}
		return false
	}
	if p.base.Channel() == model.OTPChannelAdminPanel {
		return userFacingSMTPPurpose(purpose)
	}
	return purpose == model.OTPPurposePasswordReset
}

func (p *userFacingSMTPBridge) StorageChannel(ctx context.Context, purpose model.OTPPurpose) model.OTPChannel {
	if p.smtpPreferredFor(ctx, purpose) {
		return model.OTPChannelEmail
	}
	return p.base.StorageChannel(ctx, purpose)
}

func (p *userFacingSMTPBridge) Send(ctx context.Context, userID string, code string, purpose model.OTPPurpose) error {
	if p.smtpPreferredFor(ctx, purpose) {
		p.log.Info("otp delivery: user-facing purpose via SMTP",
			slog.String("purpose", string(purpose)),
			slog.String("user_id", userID))
		return p.email.Send(ctx, userID, code, purpose)
	}
	return p.base.Send(ctx, userID, code, purpose)
}

// chainOTPProvider sends via primary first; on success optionally notifies admin provider (log).
type chainOTPProvider struct {
	primary   provider.DeliveryProvider
	secondary provider.DeliveryProvider
	channel   model.OTPChannel
}

func newChainOTPProvider(primary, secondary provider.DeliveryProvider, ch model.OTPChannel) provider.DeliveryProvider {
	return &chainOTPProvider{primary: primary, secondary: secondary, channel: ch}
}

func (c *chainOTPProvider) Channel() model.OTPChannel {
	return c.channel
}

func (c *chainOTPProvider) StorageChannel(_ context.Context, _ model.OTPPurpose) model.OTPChannel {
	return c.channel
}

func (c *chainOTPProvider) Send(ctx context.Context, userID string, code string, purpose model.OTPPurpose) error {
	if err := c.primary.Send(ctx, userID, code, purpose); err != nil {
		// When admin disables OTP email, still log code to admin_panel in "both" mode.
		if domainErr.IsCode(err, "OTP_EMAIL_DISABLED") {
			return c.secondary.Send(ctx, userID, code, purpose)
		}
		return err
	}
	_ = c.secondary.Send(ctx, userID, code, purpose)
	return nil
}
