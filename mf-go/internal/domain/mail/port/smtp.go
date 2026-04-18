package port

import (
	"context"

	"github.com/masterfabric/masterfabric_go_basic/internal/shared/config"
)

// SMTPConfigResolver provides the effective outbound SMTP configuration (DB or env).
type SMTPConfigResolver interface {
	Resolve(ctx context.Context) (config.SMTPConfig, error)
}
