package otp

import (
	"context"
	"log/slog"
	"strings"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	mailport "github.com/masterfabric/masterfabric_go_basic/internal/domain/mail/port"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/model"
	settingsRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/settings/repository"
	inframail "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/mail"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// EmailDeliveryProvider sends OTP codes to the user's registered email via SMTP.
type EmailDeliveryProvider struct {
	log       *slog.Logger
	users     repository.UserRepository
	resolver  mailport.SMTPConfigResolver
	appName   string
	appSet    settingsRepo.AppSettingsRepository
}

// NewEmailDeliveryProvider constructs an SMTP-backed OTP sender.
// appName is used in subject/body (see config OTP_APP_NAME).
func NewEmailDeliveryProvider(
	log *slog.Logger,
	users repository.UserRepository,
	resolver mailport.SMTPConfigResolver,
	appName string,
	appSet settingsRepo.AppSettingsRepository,
) *EmailDeliveryProvider {
	if appName == "" {
		appName = "MasterFabric"
	}
	return &EmailDeliveryProvider{
		log:      log,
		users:    users,
		resolver: resolver,
		appName:  appName,
		appSet:   appSet,
	}
}

func (p *EmailDeliveryProvider) Channel() model.OTPChannel {
	return model.OTPChannelEmail
}

func (p *EmailDeliveryProvider) StorageChannel(_ context.Context, _ model.OTPPurpose) model.OTPChannel {
	return p.Channel()
}

func (p *EmailDeliveryProvider) appSetting(ctx context.Context, key string) string {
	if p.appSet == nil {
		return ""
	}
	row, err := p.appSet.FindByKey(ctx, key)
	if err != nil || row == nil {
		return ""
	}
	return strings.TrimSpace(row.Value)
}

func (p *EmailDeliveryProvider) otpEmailEnabled(ctx context.Context) bool {
	v := strings.ToLower(p.appSetting(ctx, AppSettingOTPEmailEnabled))
	if v == "" {
		return true
	}
	return v != "false" && v != "0" && v != "no" && v != "off"
}

func (p *EmailDeliveryProvider) Send(ctx context.Context, userID string, code string, purpose model.OTPPurpose) error {
	if !p.otpEmailEnabled(ctx) {
		return domainErr.ErrOTPEmailDisabled
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return domainErr.ErrTokenInvalid
	}
	user, err := p.users.FindByID(ctx, uid)
	if err != nil || user == nil {
		return domainErr.ErrUserNotFound
	}
	email := strings.TrimSpace(user.Email)
	if email == "" {
		return domainErr.ErrOTPUserEmailMissing
	}

	smtpCfg, err := p.resolver.Resolve(ctx)
	if err != nil {
		p.log.Error("otp email resolve smtp failed", slog.String("user_id", userID), slog.Any("error", err))
		return domainErr.New("OTP_EMAIL_FAILED", "we could not send the verification email. Please try again later.", err)
	}
	if !smtpCfg.IsConfigured() {
		return domainErr.New("OTP_EMAIL_FAILED", "we could not send the verification email. Please try again later.", nil)
	}

	data := MailTemplateData{
		AppName:       p.appName,
		Code:          code,
		PurposeHuman:  purposeHuman(purpose),
		ExpiryMinutes: 5,
	}

	var subjectTpl, bodyTpl string
	if usePasswordResetTemplate(purpose) {
		subjectTpl = p.appSetting(ctx, AppSettingOTPEmailSubjectPasswordReset)
		bodyTpl = p.appSetting(ctx, AppSettingOTPEmailBodyPasswordReset)
	} else {
		subjectTpl = p.appSetting(ctx, AppSettingOTPEmailSubjectLogin)
		bodyTpl = p.appSetting(ctx, AppSettingOTPEmailBodyLogin)
	}

	subject := defaultOTPSubject(p.appName)
	if subjectTpl != "" {
		if s, err := renderMailTemplate(subjectTpl, data); err != nil {
			p.log.Warn("otp email subject template failed, using default", slog.Any("error", err))
		} else if s != "" {
			subject = s
		}
	}

	body := defaultOTPBody(p.appName, code, purpose)
	if bodyTpl != "" {
		if b, err := renderMailTemplate(bodyTpl, data); err != nil {
			p.log.Warn("otp email body template failed, using default", slog.Any("error", err))
		} else if b != "" {
			body = b
		}
	}

	if err := inframail.SendPlainText(smtpCfg, email, subject, body); err != nil {
		p.log.Error("otp email smtp failed",
			slog.String("user_id", userID),
			slog.String("purpose", string(purpose)),
			slog.Any("error", err),
		)
		return domainErr.New("OTP_EMAIL_FAILED", "we could not send the verification email. Please try again later.", err)
	}

	p.log.Info("otp email sent",
		slog.String("user_id", userID),
		slog.String("purpose", string(purpose)),
		slog.String("to_domain", domainOf(email)),
	)
	return nil
}

func domainOf(email string) string {
	if i := strings.LastIndex(email, "@"); i >= 0 && i+1 < len(email) {
		return email[i+1:]
	}
	return ""
}
