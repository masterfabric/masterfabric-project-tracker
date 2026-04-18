package dto

import "time"

// AdminMailSMTPSettingsResponse is the admin-safe view (no raw password).
type AdminMailSMTPSettingsResponse struct {
	Enabled            bool
	Host               string
	Port               int
	Username           string
	PasswordConfigured bool
	FromAddress        string
	FromName          string
	SubjectPrefix     string
	ImplicitTLS       bool
	PlainNoTLS        bool
	UpdatedAt         time.Time
}

// AdminUpdateMailSMTPRequest updates the singleton row (full form from admin UI).
// Password: nil = leave unchanged; pointer to empty string = clear; non-empty = set.
type AdminUpdateMailSMTPRequest struct {
	Enabled       bool
	Host          string
	Port          int
	Username      string
	Password      *string
	FromAddress   string
	FromName      string
	SubjectPrefix string
	ImplicitTLS   bool
	PlainNoTLS    bool
}
