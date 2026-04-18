package mail

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	mailModel "github.com/masterfabric/masterfabric_go_basic/internal/domain/mail/model"
	mailRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/mail/repository"
	"github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/crypto/smtppw"
)

// MailSMTPRepo implements MailSMTPRepository.
type MailSMTPRepo struct {
	db    *pgxpool.Pool
	pwKey []byte // nil or len 32 — when 32, passwords are AES-256-GCM at rest (mf1:… in DB)
}

// NewMailSMTPRepo creates a MailSMTPRepo. pwKey should be cfg.MailSMTPEncryptionKey (nil or 32 bytes).
func NewMailSMTPRepo(db *pgxpool.Pool, pwKey []byte) *MailSMTPRepo {
	return &MailSMTPRepo{db: db, pwKey: pwKey}
}

var _ mailRepo.MailSMTPRepository = (*MailSMTPRepo)(nil)

const mailSMTPSelect = `
SELECT id, enabled, host, port, COALESCE(username, ''), COALESCE(password, ''),
       COALESCE(from_address, ''), COALESCE(from_name, ''), COALESCE(subject_prefix, 'MasterFabric'),
       implicit_tls, plain_no_tls, created_at, updated_at
FROM system_mail_smtp WHERE id = 1`

// Get returns the singleton row (must exist after migrations). Password is decrypted for in-memory use.
func (r *MailSMTPRepo) Get(ctx context.Context) (*mailModel.SystemMailSMTP, error) {
	row := r.db.QueryRow(ctx, mailSMTPSelect)
	var m mailModel.SystemMailSMTP
	var storedPW string
	err := row.Scan(
		&m.ID, &m.Enabled, &m.Host, &m.Port, &m.Username, &storedPW,
		&m.FromAddress, &m.FromName, &m.SubjectPrefix,
		&m.ImplicitTLS, &m.PlainNoTLS, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("mail smtp get: %w", err)
	}
	plain, err := smtppw.Decrypt(storedPW, r.pwKey)
	if err != nil {
		return nil, fmt.Errorf("mail smtp password: %w", err)
	}
	m.Password = plain
	return &m, nil
}

// Upsert updates the singleton row (id = 1). Plaintext Password is encrypted if pwKey is set.
func (r *MailSMTPRepo) Upsert(ctx context.Context, row *mailModel.SystemMailSMTP) error {
	storedPW := row.Password
	if len(r.pwKey) == 32 {
		enc, err := smtppw.Encrypt(row.Password, r.pwKey)
		if err != nil {
			return fmt.Errorf("mail smtp encrypt password: %w", err)
		}
		storedPW = enc
	}
	_, err := r.db.Exec(ctx, `
		UPDATE system_mail_smtp SET
			enabled = $1,
			host = $2,
			port = $3,
			username = $4,
			password = $5,
			from_address = $6,
			from_name = $7,
			subject_prefix = $8,
			implicit_tls = $9,
			plain_no_tls = $10,
			updated_at = now()
		WHERE id = 1`,
		row.Enabled, row.Host, row.Port, row.Username, storedPW,
		row.FromAddress, row.FromName, row.SubjectPrefix,
		row.ImplicitTLS, row.PlainNoTLS,
	)
	if err != nil {
		return fmt.Errorf("mail smtp upsert: %w", err)
	}
	return nil
}
