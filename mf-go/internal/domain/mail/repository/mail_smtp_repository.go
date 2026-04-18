package repository

import (
	"context"

	"github.com/masterfabric/masterfabric_go_basic/internal/domain/mail/model"
)

// MailSMTPRepository persists the singleton system_mail_smtp row.
type MailSMTPRepository interface {
	Get(ctx context.Context) (*model.SystemMailSMTP, error)
	Upsert(ctx context.Context, row *model.SystemMailSMTP) error
}
