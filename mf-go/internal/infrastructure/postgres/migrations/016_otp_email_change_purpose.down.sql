DELETE FROM otp_codes WHERE purpose = 'email_change';

ALTER TABLE otp_codes DROP CONSTRAINT IF EXISTS otp_codes_purpose_check;
ALTER TABLE otp_codes ADD CONSTRAINT otp_codes_purpose_check
  CHECK (purpose IN (
    'login',
    'verify_identity',
    'password_reset',
    'account_activate'
  ));
