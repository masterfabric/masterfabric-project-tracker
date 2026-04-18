package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/masterfabric/masterfabric_go_basic/internal/application/mail/dto"
	mailModel "github.com/masterfabric/masterfabric_go_basic/internal/domain/mail/model"
	mailRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/mail/repository"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	inframail "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/mail"
	infraRedis "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/redis"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/config"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/middleware"
)

// GetAdminMailSMTPSettingsUseCase returns admin-safe SMTP settings.
type GetAdminMailSMTPSettingsUseCase struct {
	repo mailRepo.MailSMTPRepository
}

// NewGetAdminMailSMTPSettingsUseCase constructs the use case.
func NewGetAdminMailSMTPSettingsUseCase(repo mailRepo.MailSMTPRepository) *GetAdminMailSMTPSettingsUseCase {
	return &GetAdminMailSMTPSettingsUseCase{repo: repo}
}

// Execute loads the singleton row.
func (uc *GetAdminMailSMTPSettingsUseCase) Execute(ctx context.Context) (*dto.AdminMailSMTPSettingsResponse, error) {
	if err := policy.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	row, err := uc.repo.Get(ctx)
	if err != nil {
		return nil, err
	}
	return adminRowToDTO(row), nil
}

func adminRowToDTO(row *mailModel.SystemMailSMTP) *dto.AdminMailSMTPSettingsResponse {
	return &dto.AdminMailSMTPSettingsResponse{
		Enabled:            row.Enabled,
		Host:               row.Host,
		Port:               row.Port,
		Username:           row.Username,
		PasswordConfigured: strings.TrimSpace(row.Password) != "",
		FromAddress:        row.FromAddress,
		FromName:           row.FromName,
		SubjectPrefix:      row.SubjectPrefix,
		ImplicitTLS:        row.ImplicitTLS,
		PlainNoTLS:         row.PlainNoTLS,
		UpdatedAt:          row.UpdatedAt,
	}
}

// UpdateAdminMailSMTPSettingsUseCase persists admin SMTP changes.
type UpdateAdminMailSMTPSettingsUseCase struct {
	repo     mailRepo.MailSMTPRepository
	resolver *EffectiveSMTPResolver
	cfg      *config.Config
}

// NewUpdateAdminMailSMTPSettingsUseCase constructs the use case.
func NewUpdateAdminMailSMTPSettingsUseCase(
	repo mailRepo.MailSMTPRepository,
	resolver *EffectiveSMTPResolver,
	cfg *config.Config,
) *UpdateAdminMailSMTPSettingsUseCase {
	return &UpdateAdminMailSMTPSettingsUseCase{repo: repo, resolver: resolver, cfg: cfg}
}

// Execute merges input into the singleton row.
func (uc *UpdateAdminMailSMTPSettingsUseCase) Execute(ctx context.Context, req *dto.AdminUpdateMailSMTPRequest) (*dto.AdminMailSMTPSettingsResponse, error) {
	if err := policy.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	row, err := uc.repo.Get(ctx)
	if err != nil {
		return nil, err
	}
	row.Enabled = req.Enabled
	row.Host = strings.TrimSpace(req.Host)
	row.Port = req.Port
	row.Username = req.Username
	if req.Password != nil {
		row.Password = *req.Password
	}
	row.FromAddress = strings.TrimSpace(req.FromAddress)
	row.FromName = strings.TrimSpace(req.FromName)
	row.SubjectPrefix = strings.TrimSpace(req.SubjectPrefix)
	row.ImplicitTLS = req.ImplicitTLS
	row.PlainNoTLS = req.PlainNoTLS

	if uc.cfg.IsProduction() && row.Enabled && row.PlainNoTLS {
		return nil, domainErr.New("MAIL_PLAIN_TLS_REQUIRED", "plain SMTP without TLS is not allowed in production", nil)
	}

	effective := RowToSMTP(row, uc.cfg.SMTP.SubjectPrefix)
	if row.Enabled && !effective.IsConfigured() {
		return nil, domainErr.New("MAIL_SMTP_INCOMPLETE", "enabled SMTP requires host, from address, and a valid port", nil)
	}

	if err := uc.repo.Upsert(ctx, row); err != nil {
		return nil, err
	}
	uc.resolver.InvalidateEffectiveCache(ctx)

	updated, err := uc.repo.Get(ctx)
	if err != nil {
		return nil, err
	}
	return adminRowToDTO(updated), nil
}

// AdminSendTestMailUseCase sends a test message to a chosen address.
type AdminSendTestMailUseCase struct {
	resolver *EffectiveSMTPResolver
	cache    *infraRedis.CacheHandler
	cfg      *config.Config
}

// NewAdminSendTestMailUseCase constructs the use case.
func NewAdminSendTestMailUseCase(
	resolver *EffectiveSMTPResolver,
	cache *infraRedis.CacheHandler,
	cfg *config.Config,
) *AdminSendTestMailUseCase {
	return &AdminSendTestMailUseCase{resolver: resolver, cache: cache, cfg: cfg}
}

const adminTestMailRateLimit = 1 * time.Minute

// Execute sends a short test email.
func (uc *AdminSendTestMailUseCase) Execute(ctx context.Context, toEmail string) error {
	if err := policy.RequireAdmin(ctx); err != nil {
		return err
	}
	toEmail = strings.TrimSpace(toEmail)
	if toEmail == "" {
		return domainErr.New("MAIL_INVALID_RECIPIENT", "recipient email is required", nil)
	}

	adminID := middleware.UserIDFromContext(ctx)
	if adminID != uuid.Nil && uc.cache.Available() {
		rlKey := infraRedis.AdminMailTestRateLimitKey(adminID.String())
		exists, _ := uc.cache.Exists(ctx, rlKey)
		if exists {
			return domainErr.New("MAIL_TEST_RATE_LIMITED", "please wait before sending another test email", nil)
		}
		_ = uc.cache.Set(ctx, rlKey, "1", adminTestMailRateLimit)
	}

	smtpCfg, err := uc.resolver.Resolve(ctx)
	if err != nil {
		return fmt.Errorf("mail test: resolve smtp: %w", err)
	}
	if !smtpCfg.IsConfigured() {
		return domainErr.New("MAIL_SMTP_NOT_CONFIGURED", "SMTP is not configured (admin mail settings or SMTP_* env)", nil)
	}

	subject := fmt.Sprintf("%s — SMTP test", smtpCfg.SubjectPrefix)
	body := "This is a test message from MasterFabric mail settings.\n\nIf you received this, outbound SMTP is working.\n"
	if err := inframail.SendPlainText(smtpCfg, toEmail, subject, body); err != nil {
		return domainErr.New("MAIL_SEND_FAILED", "could not send test email", err)
	}
	return nil
}

// AdminSendUserEmailUseCase sends a plain-text email to a user's registered address.
type AdminSendUserEmailUseCase struct {
	resolver *EffectiveSMTPResolver
	users    repository.UserRepository
}

// NewAdminSendUserEmailUseCase constructs the use case.
func NewAdminSendUserEmailUseCase(
	resolver *EffectiveSMTPResolver,
	users repository.UserRepository,
) *AdminSendUserEmailUseCase {
	return &AdminSendUserEmailUseCase{resolver: resolver, users: users}
}

// Execute resolves the user profile email and sends mail.
func (uc *AdminSendUserEmailUseCase) Execute(ctx context.Context, userID uuid.UUID, subject, body string) error {
	if err := policy.RequireAdmin(ctx); err != nil {
		return err
	}
	subject = strings.TrimSpace(subject)
	body = strings.TrimSpace(body)
	if subject == "" {
		return domainErr.New("MAIL_INVALID_SUBJECT", "subject is required", nil)
	}
	if body == "" {
		return domainErr.New("MAIL_INVALID_BODY", "body is required", nil)
	}

	user, err := uc.users.FindByID(ctx, userID)
	if err != nil || user == nil {
		return domainErr.ErrUserNotFound
	}
	to := strings.TrimSpace(user.Email)
	if to == "" {
		return domainErr.New("MAIL_USER_NO_EMAIL", "user has no email address", nil)
	}

	smtpCfg, err := uc.resolver.Resolve(ctx)
	if err != nil {
		return fmt.Errorf("mail user: resolve smtp: %w", err)
	}
	if !smtpCfg.IsConfigured() {
		return domainErr.New("MAIL_SMTP_NOT_CONFIGURED", "SMTP is not configured (admin mail settings or SMTP_* env)", nil)
	}

	if err := inframail.SendPlainText(smtpCfg, to, subject, body); err != nil {
		return domainErr.New("MAIL_SEND_FAILED", "could not send email", err)
	}
	return nil
}
