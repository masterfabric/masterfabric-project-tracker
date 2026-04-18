package mail

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"strings"

	"github.com/masterfabric/masterfabric_go_basic/internal/shared/config"
)

// SendPlainText sends a single plain-text email using SMTPConfig.
func SendPlainText(cfg config.SMTPConfig, toEmail, subject, body string) error {
	if !cfg.IsConfigured() {
		return fmt.Errorf("smtp: configuration incomplete")
	}
	if toEmail == "" {
		return fmt.Errorf("smtp: empty recipient")
	}

	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	msg := buildRFC822(cfg, toEmail, subject, body)

	var auth smtp.Auth
	if cfg.Username != "" {
		auth = smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
	}

	switch {
	case cfg.PlainNoTLS:
		conn, err := net.Dial("tcp", addr)
		if err != nil {
			return fmt.Errorf("smtp dial: %w", err)
		}
		defer conn.Close()
		return smtpPlainSendNoTLS(conn, cfg.Host, auth, cfg.From, []string{toEmail}, msg)
	case cfg.ImplicitTLS:
		tlsCfg := &tls.Config{ServerName: cfg.Host, MinVersion: tls.VersionTLS12}
		conn, err := tls.Dial("tcp", addr, tlsCfg)
		if err != nil {
			return fmt.Errorf("smtp tls dial: %w", err)
		}
		defer conn.Close()
		return smtpPlainSendNoTLS(conn, cfg.Host, auth, cfg.From, []string{toEmail}, msg)
	default:
		return smtp.SendMail(addr, auth, cfg.From, []string{toEmail}, msg)
	}
}

func buildRFC822(cfg config.SMTPConfig, to, subject, body string) []byte {
	var b strings.Builder
	if cfg.FromName != "" {
		fmt.Fprintf(&b, "From: %s <%s>\r\n", quoteDisplayName(cfg.FromName), cfg.From)
	} else {
		fmt.Fprintf(&b, "From: %s\r\n", cfg.From)
	}
	fmt.Fprintf(&b, "To: %s\r\n", to)
	fmt.Fprintf(&b, "Subject: %s\r\n", subject)
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	b.WriteString("\r\n")
	b.WriteString(body)
	if !strings.HasSuffix(body, "\n") {
		b.WriteString("\r\n")
	}
	return []byte(b.String())
}

func quoteDisplayName(name string) string {
	if strings.ContainsAny(name, "\r\n\"\\") {
		name = strings.ReplaceAll(name, "\\", "\\\\")
		name = strings.ReplaceAll(name, "\"", "\\\"")
		return "\"" + name + "\""
	}
	return name
}

func smtpPlainSendNoTLS(conn net.Conn, host string, auth smtp.Auth, from string, to []string, msg []byte) error {
	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer client.Close()

	if auth != nil {
		if ok, _ := client.Extension("AUTH"); ok {
			if err := client.Auth(auth); err != nil {
				return fmt.Errorf("smtp auth: %w", err)
			}
		}
	}

	if err := client.Mail(from); err != nil {
		return fmt.Errorf("smtp mail: %w", err)
	}
	for _, rcpt := range to {
		if err := client.Rcpt(rcpt); err != nil {
			return fmt.Errorf("smtp rcpt: %w", err)
		}
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		return err
	}
	return w.Close()
}
