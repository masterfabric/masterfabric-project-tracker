// Package smtppw encrypts SMTP mailbox passwords for storage in system_mail_smtp (AES-256-GCM).
package smtppw

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"
)

const encPrefix = "mf1:"

// ErrDecrypt means the ciphertext could not be authenticated or parsed.
var ErrDecrypt = errors.New("smtp password decrypt failed")

// Encrypt returns a prefixed base64 blob, or empty string if plaintext is empty.
// key must be 32 bytes (AES-256).
func Encrypt(plaintext string, key []byte) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	if len(key) != 32 {
		return "", fmt.Errorf("encryption key must be 32 bytes, got %d", len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nil, nonce, []byte(plaintext), nil)
	blob := make([]byte, 0, len(nonce)+len(ciphertext))
	blob = append(blob, nonce...)
	blob = append(blob, ciphertext...)
	return encPrefix + base64.RawStdEncoding.EncodeToString(blob), nil
}

// Decrypt reverses Encrypt. Values without encPrefix are returned unchanged (legacy DB plaintext).
// key must be 32 bytes when the stored value is encrypted.
func Decrypt(stored string, key []byte) (string, error) {
	stored = strings.TrimSpace(stored)
	if stored == "" {
		return "", nil
	}
	if !strings.HasPrefix(stored, encPrefix) {
		return stored, nil
	}
	if len(key) != 32 {
		return "", fmt.Errorf("%w: MAIL_SMTP_ENCRYPTION_KEY must be 32 bytes for encrypted passwords", ErrDecrypt)
	}
	raw, err := base64.RawStdEncoding.DecodeString(strings.TrimPrefix(stored, encPrefix))
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrDecrypt, err)
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	ns := gcm.NonceSize()
	if len(raw) < ns {
		return "", ErrDecrypt
	}
	nonce, ct := raw[:ns], raw[ns:]
	plain, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrDecrypt, err)
	}
	return string(plain), nil
}

// IsEncrypted reports whether the DB value uses the mf1 envelope.
func IsEncrypted(stored string) bool {
	return strings.HasPrefix(strings.TrimSpace(stored), encPrefix)
}
