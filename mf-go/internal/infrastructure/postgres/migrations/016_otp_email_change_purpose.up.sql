-- Allow OTP purpose "email_change" for sign-in email updates (verify current inbox).

ALTER TABLE otp_codes DROP CONSTRAINT IF EXISTS otp_codes_purpose_check;
ALTER TABLE otp_codes ADD CONSTRAINT otp_codes_purpose_check
  CHECK (purpose IN (
    'login',
    'verify_identity',
    'password_reset',
    'account_activate',
    'email_change'
  ));
