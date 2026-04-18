package smtppw

import (
	"testing"
)

func TestRoundTrip(t *testing.T) {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	plain := "app-specific-password-☺"
	enc, err := Encrypt(plain, key)
	if err != nil {
		t.Fatal(err)
	}
	if enc == plain || !IsEncrypted(enc) {
		t.Fatalf("expected encrypted prefix, got %q", enc)
	}
	out, err := Decrypt(enc, key)
	if err != nil {
		t.Fatal(err)
	}
	if out != plain {
		t.Fatalf("got %q want %q", out, plain)
	}
}

func TestLegacyPlaintext(t *testing.T) {
	key := make([]byte, 32)
	out, err := Decrypt("plain-secret", key)
	if err != nil {
		t.Fatal(err)
	}
	if out != "plain-secret" {
		t.Fatalf("got %q", out)
	}
}

func TestWrongKey(t *testing.T) {
	key := make([]byte, 32)
	key[0] = 7
	enc, err := Encrypt("x", key)
	if err != nil {
		t.Fatal(err)
	}
	key2 := make([]byte, 32)
	key2[0] = 9
	_, err = Decrypt(enc, key2)
	if err == nil {
		t.Fatal("expected decrypt error")
	}
}
