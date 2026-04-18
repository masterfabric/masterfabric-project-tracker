package usecase

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/masterfabric/masterfabric_go_basic/internal/shared/config"
)

// ValidateOTPEmailSMTP checks production OTP email/both has a usable effective SMTP config
// (env or enabled DB row). Call after DB + EffectiveSMTPResolver are available.
func ValidateOTPEmailSMTP(ctx context.Context, cfg *config.Config, resolver *EffectiveSMTPResolver) {
	otpMode := strings.ToLower(strings.TrimSpace(cfg.OTP.Delivery))
	if otpMode != "email" && otpMode != "both" {
		return
	}
	smtpCfg, err := resolver.ResolveForReadiness(ctx)
	if err != nil {
		if cfg.IsProduction() {
			log.Fatalf("FATAL: OTP_DELIVERY=%s but could not load mail SMTP settings: %v", cfg.OTP.Delivery, err)
		}
		fmt.Printf("[SECURITY WARNING] OTP_DELIVERY is email/both but SMTP settings could not be loaded: %v\n", err)
		return
	}
	if !smtpCfg.IsConfigured() {
		if cfg.IsProduction() {
			log.Fatalf("FATAL: OTP_DELIVERY=%s requires SMTP (configure system_mail_smtp in admin or set SMTP_* env).", cfg.OTP.Delivery)
		}
		fmt.Println("[SECURITY WARNING] OTP_DELIVERY is email/both but SMTP is not fully configured. OTP will fall back to admin_panel at runtime.")
	}
	if cfg.IsProduction() && smtpCfg.PlainNoTLS {
		log.Fatalf("FATAL: effective SMTP has plain_no_tls (SMTP_PLAIN_NO_TLS or DB); must be false in production.")
	}
}
