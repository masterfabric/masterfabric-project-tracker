package otp

import (
	"fmt"
	"strings"
	"unicode"
)

// normalizeWhatsAppRecipient strips non-digits; WhatsApp Cloud API expects country code + number, no + prefix.
func normalizeWhatsAppRecipient(phone string) (string, error) {
	var b strings.Builder
	for _, r := range strings.TrimSpace(phone) {
		if unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	s := b.String()
	if len(s) < 8 || len(s) > 15 {
		return "", fmt.Errorf("phone must be 8–15 digits (include country code, e.g. 15551234567)")
	}
	return s, nil
}
