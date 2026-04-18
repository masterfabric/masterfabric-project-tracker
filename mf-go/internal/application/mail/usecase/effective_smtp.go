package usecase

import (
	"context"
	"strings"

	mailModel "github.com/masterfabric/masterfabric_go_basic/internal/domain/mail/model"
	mailRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/mail/repository"
	infraRedis "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/redis"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/config"
)

// EffectiveSMTPResolver merges DB system_mail_smtp (when enabled + complete) with env fallback.
type EffectiveSMTPResolver struct {
	repo      mailRepo.MailSMTPRepository
	env       *config.Config
	cache     *infraRedis.CacheHandler
	keyPrefix string
}

// NewEffectiveSMTPResolver constructs EffectiveSMTPResolver.
func NewEffectiveSMTPResolver(
	repo mailRepo.MailSMTPRepository,
	env *config.Config,
	cache *infraRedis.CacheHandler,
	keyPrefix string,
) *EffectiveSMTPResolver {
	return &EffectiveSMTPResolver{repo: repo, env: env, cache: cache, keyPrefix: keyPrefix}
}

// RowToSMTP maps DB row to config.SMTPConfig.
func RowToSMTP(m *mailModel.SystemMailSMTP, envSubjectPrefix string) config.SMTPConfig {
	prefix := strings.TrimSpace(m.SubjectPrefix)
	if prefix == "" {
		prefix = strings.TrimSpace(envSubjectPrefix)
	}
	if prefix == "" {
		prefix = "MasterFabric"
	}
	port := m.Port
	if port <= 0 {
		port = 587
	}
	return config.SMTPConfig{
		Host:          strings.TrimSpace(m.Host),
		Port:          port,
		Username:      m.Username,
		Password:      m.Password,
		From:          strings.TrimSpace(m.FromAddress),
		FromName:      strings.TrimSpace(m.FromName),
		SubjectPrefix: prefix,
		ImplicitTLS:   m.ImplicitTLS,
		PlainNoTLS:    m.PlainNoTLS,
	}
}

// MergeEffective returns DB SMTP when enabled and configured, else env SMTP.
func MergeEffective(row *mailModel.SystemMailSMTP, env config.SMTPConfig) config.SMTPConfig {
	if row != nil && row.Enabled {
		c := RowToSMTP(row, env.SubjectPrefix)
		if c.IsConfigured() {
			return c
		}
	}
	return env
}

// Resolve returns the effective SMTP config for outbound mail.
// Resolved SMTP (including decrypted DB password) is not cached in Redis — avoids duplicating secrets.
func (r *EffectiveSMTPResolver) Resolve(ctx context.Context) (config.SMTPConfig, error) {
	row, err := r.repo.Get(ctx)
	if err != nil {
		return config.SMTPConfig{}, err
	}
	return MergeEffective(row, r.env.SMTP), nil
}

// InvalidateEffectiveCache drops the resolved SMTP cache entry.
func (r *EffectiveSMTPResolver) InvalidateEffectiveCache(ctx context.Context) {
	if r.cache.Available() {
		_ = r.cache.Del(ctx, infraRedis.EffectiveMailSMTPKey(r.keyPrefix))
	}
}

// ResolveForReadiness computes effective SMTP without reading or writing Redis.
func (r *EffectiveSMTPResolver) ResolveForReadiness(ctx context.Context) (config.SMTPConfig, error) {
	row, err := r.repo.Get(ctx)
	if err != nil {
		return config.SMTPConfig{}, err
	}
	return MergeEffective(row, r.env.SMTP), nil
}
