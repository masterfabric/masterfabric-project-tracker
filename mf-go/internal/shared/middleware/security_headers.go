package middleware

import (
	"net/http"
	"strings"
)

// SecurityHeadersConfig toggles optional hardening for SecurityHeaders.
type SecurityHeadersConfig struct {
	// DisableHSTS skips Strict-Transport-Security even on HTTPS requests (e.g. broken proxy headers).
	DisableHSTS bool
}

func isHTTPSRequest(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	return strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}

// SecurityHeaders sets standard HTTP security headers appropriate for an API server.
func SecurityHeaders(cfg SecurityHeadersConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
			w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
			w.Header().Set("X-XSS-Protection", "1; mode=block")
			w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
			if !cfg.DisableHSTS && isHTTPSRequest(r) {
				w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
			}
			next.ServeHTTP(w, r)
		})
	}
}
