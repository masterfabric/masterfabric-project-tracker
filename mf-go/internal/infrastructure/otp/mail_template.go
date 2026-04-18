package otp

import (
	"bytes"
	"fmt"
	"strings"
	"text/template"

	"github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/model"
)

// MailTemplateData is passed to admin-configured text/template strings.
type MailTemplateData struct {
	AppName         string
	Code            string
	PurposeHuman    string
	ExpiryMinutes   int
}

func defaultOTPSubject(appName string) string {
	return fmt.Sprintf("%s — Your verification code", appName)
}

func defaultOTPBody(appName, code string, purpose model.OTPPurpose) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Hi,\n\n")
	fmt.Fprintf(&b, "Your %s verification code is:\n\n", appName)
	fmt.Fprintf(&b, "  %s\n\n", code)
	fmt.Fprintf(&b, "This code expires in a few minutes.\n\n")
	fmt.Fprintf(&b, "Purpose: %s\n\n", purposeHuman(purpose))
	b.WriteString("If you did not request this code, you can ignore this email.\n")
	return b.String()
}

func purposeHuman(p model.OTPPurpose) string {
	switch p {
	case model.OTPPurposeLogin:
		return "Sign-in verification"
	case model.OTPPurposeVerifyIdentity:
		return "Identity verification"
	case model.OTPPurposePasswordReset:
		return "Password reset"
	case model.OTPPurposeAccountActivate:
		return "Account activation"
	case model.OTPPurposeEmailChange:
		return "Email address change"
	default:
		return string(p)
	}
}

func renderMailTemplate(tpl string, data MailTemplateData) (string, error) {
	tpl = strings.TrimSpace(tpl)
	if tpl == "" {
		return "", nil
	}
	t, err := template.New("otp_mail").Parse(tpl)
	if err != nil {
		return "", fmt.Errorf("otp mail template parse: %w", err)
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("otp mail template execute: %w", err)
	}
	return strings.TrimSpace(buf.String()), nil
}

func usePasswordResetTemplate(purpose model.OTPPurpose) bool {
	return purpose == model.OTPPurposePasswordReset
}
