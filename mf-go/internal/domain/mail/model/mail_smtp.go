package model

import "time"

// SystemMailSMTP is the singleton outbound SMTP configuration row (id = 1).
// Password in Postgres is AES-256-GCM when MAIL_SMTP_ENCRYPTION_KEY is set (mf1:…),
// else legacy plaintext — see SECURITY.md.
type SystemMailSMTP struct {
	ID             int16
	Enabled        bool
	Host           string
	Port           int
	Username       string
	Password       string
	FromAddress    string
	FromName       string
	SubjectPrefix  string
	ImplicitTLS    bool
	PlainNoTLS     bool
	CreatedAt      time.Time
	UpdatedAt      time.Time
}
