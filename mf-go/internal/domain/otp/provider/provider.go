package provider

import (
	"context"

	"github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/model"
)

// DeliveryProvider is the abstraction for sending OTP codes to users.
// Implementations exist per channel (admin panel, email, SMS, WhatsApp, Telegram).
// The active provider is selected at runtime based on configuration.
type DeliveryProvider interface {
	// Channel returns the OTPChannel this provider handles.
	Channel() model.OTPChannel

	// StorageChannel is persisted on OTP rows and returned to clients from requestOTP.
	// When Send may use a different path than Channel() (e.g. SMTP bridge for some purposes),
	// this must match the channel used for that purpose.
	StorageChannel(ctx context.Context, purpose model.OTPPurpose) model.OTPChannel

	// Send delivers the OTP code to the user. The implementation decides
	// how to reach the user (e.g. admin panel just stores it; email sends a mail).
	Send(ctx context.Context, userID string, code string, purpose model.OTPPurpose) error
}
