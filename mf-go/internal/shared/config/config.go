package config

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log"
	"math"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all runtime configuration loaded from environment variables.
type Config struct {
	// Env is the runtime environment: "development", "staging", or "production".
	Env      string
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	Cache    CacheConfig
	RabbitMQ RabbitMQConfig
	JWT      JWTConfig
	Log      LogConfig
	GraphQL  GraphQLConfig
	CORS     CORSConfig
	OTP      OTPConfig
	SMTP     SMTPConfig
	// MailSMTPEncryptionKey is optional AES-256 key (32 bytes) for encrypting
	// system_mail_smtp.password at rest. Parsed from MAIL_SMTP_ENCRYPTION_KEY.
	MailSMTPEncryptionKey []byte
	WhatsApp              WhatsAppConfig
	Telegram              TelegramConfig
	// OneSignal drives optional push for task assignment + due reminders (REST API).
	OneSignal OneSignalConfig
}

// OneSignalConfig holds OneSignal REST credentials. Empty RESTAPIKey disables outbound calls.
type OneSignalConfig struct {
	AppID      string
	RESTAPIKey string
}

// IsProduction reports whether the application is running in production mode.
func (c *Config) IsProduction() bool {
	return c.Env == "production"
}

// IsDevelopment reports whether the application is running in development mode.
func (c *Config) IsDevelopment() bool {
	return c.Env == "" || c.Env == "development"
}

type ServerConfig struct {
	Host         string
	Port         int
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
	// HTTPRateLimitPerMinute caps requests per client IP per rolling minute (0 = disabled).
	// Default: 100 in production, 0 in development. Override with HTTP_RATE_LIMIT_PER_MIN.
	HTTPRateLimitPerMinute int
	// DisableHSTS skips Strict-Transport-Security when true (HTTP_DISABLE_HSTS).
	DisableHSTS bool
}

type DatabaseConfig struct {
	DSN         string
	MaxConns    int32
	MinConns    int32
	MaxConnIdle time.Duration
}

type RedisConfig struct {
	// URL is a full redis://... connection string (e.g. from Render).
	// When set it takes precedence over Addr, Password, and DB.
	URL      string
	Addr     string
	Password string
	DB       int
	// Required makes startup fail when Redis is unreachable (recommended for production).
	Required bool
}

// CacheConfig controls cache behaviour independent of the Redis connection.
// TTL fields govern how long each class of entry lives in the cache.
// KeyPrefix is prepended to every key (useful when multiple apps share a
// Redis instance — leave empty to use the built-in "mf:" namespace).
type CacheConfig struct {
	// KeyPrefix is an optional additional namespace prefix (default: "").
	KeyPrefix string

	// DefaultTTL is used when no more-specific TTL applies.
	DefaultTTL time.Duration

	// TokenBlacklistTTL caps how long a blacklisted access token is tracked.
	// Should be at least as long as JWT.AccessTokenTTL.
	TokenBlacklistTTL time.Duration

	// RefreshTokenTTL is the lifetime of refresh tokens in the cache.
	// Should match JWT.RefreshTokenTTL.
	RefreshTokenTTL time.Duration

	// UserSettingsTTL is how long per-user settings are cached.
	UserSettingsTTL time.Duration

	// AppSettingsTTL is how long application-wide settings are cached.
	AppSettingsTTL time.Duration

	// ProductReleaseTTL is how long the published product_release row is cached.
	ProductReleaseTTL time.Duration
}

type RabbitMQConfig struct {
	URL      string
	Enabled  bool
	Exchange string
}

type JWTConfig struct {
	Secret          string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
	// MaxRefreshTokensPerUser caps concurrent refresh-token sessions per user in Redis (0 = unlimited).
	// When exceeded, oldest sessions are deleted; see AUTH_MAX_REFRESH_SESSIONS_PER_USER in README and eviction logs (event=refresh_session_eviction).
	MaxRefreshTokensPerUser int
}

type LogConfig struct {
	Level  string
	Format string
}

type GraphQLConfig struct {
	// Introspection controls whether the GraphQL introspection endpoint is
	// enabled. Disable in production to reduce the attack surface.
	Introspection bool
	// Playground controls whether the interactive playground is served on /.
	Playground bool
	// QueryDepthLimit caps the maximum nesting depth of a GraphQL query (0 = unlimited).
	QueryDepthLimit int
	// ComplexityLimit caps the total complexity score of a GraphQL query (0 = unlimited).
	ComplexityLimit int
}

type CORSConfig struct {
	// AllowedOrigins is a comma-separated list of origins; "*" allows all.
	AllowedOrigins []string
}

// OTPConfig controls how one-time codes are delivered.
type OTPConfig struct {
	// Delivery: admin_panel | email | both | whatsapp | whatsapp_both | telegram | telegram_both
	// See NewDeliveryProvider in infrastructure/otp.
	Delivery string
	// AppName is used in OTP message copy (defaults from OTP_APP_NAME or SMTP_SUBJECT_PREFIX).
	AppName string
}

// SMTPConfig holds outbound email settings for OTP (and future mail).
// Set SMTP_HOST and SMTP_FROM to enable; see OTP_DELIVERY=email.
type SMTPConfig struct {
	Host          string
	Port          int
	Username      string
	Password      string
	From          string
	FromName      string
	SubjectPrefix string
	// ImplicitTLS uses TLS from the first byte (typical for port 465).
	ImplicitTLS bool
	// PlainNoTLS skips TLS/STARTTLS (local dev only, e.g. Mailpit on :1025).
	PlainNoTLS bool
}

// IsConfigured reports whether required SMTP fields are set for sending mail.
func (s *SMTPConfig) IsConfigured() bool {
	return s.Host != "" && s.From != "" && s.Port > 0
}

// WhatsAppConfig is Meta WhatsApp Cloud API (Graph).
type WhatsAppConfig struct {
	AccessToken   string
	PhoneNumberID string
	APIVersion    string // e.g. v21.0
}

// IsConfigured reports whether WhatsApp Cloud API can send messages.
func (w *WhatsAppConfig) IsConfigured() bool {
	return w.AccessToken != "" && w.PhoneNumberID != ""
}

// TelegramConfig is the Bot API token for sendMessage.
type TelegramConfig struct {
	BotToken string
}

// IsConfigured reports whether Telegram Bot API can send messages.
func (t *TelegramConfig) IsConfigured() bool {
	return t.BotToken != ""
}

const (
	defaultJWTSecret = "change-me-in-production-at-least-32-chars"
	minJWTSecretLen  = 32
)

// Load reads configuration from environment variables with sane defaults.
func Load() *Config {
	env := getEnv("ENV", "development")
	isProd := env == "production"

	rateLimitDefault := 100
	if !isProd {
		rateLimitDefault = 0
	}
	logLevelDefault := "info"
	if isProd {
		logLevelDefault = "warn"
	}
	return &Config{
		Env: env,
		Server: ServerConfig{
			Host:                   getEnv("SERVER_HOST", "0.0.0.0"),
			Port:                   portFromEnv(),
			ReadTimeout:            getEnvDuration("SERVER_READ_TIMEOUT", 15*time.Second),
			WriteTimeout:           getEnvDuration("SERVER_WRITE_TIMEOUT", 15*time.Second),
			IdleTimeout:            getEnvDuration("SERVER_IDLE_TIMEOUT", 60*time.Second),
			HTTPRateLimitPerMinute: getEnvInt("HTTP_RATE_LIMIT_PER_MIN", rateLimitDefault),
			DisableHSTS:            getEnvBool("HTTP_DISABLE_HSTS", false),
		},
		Database: DatabaseConfig{
			DSN:         getEnv("DATABASE_DSN", "postgres://masterfabric:masterfabric@localhost:5433/masterfabric_basic?sslmode=disable"),
			MaxConns:    envInt32("DATABASE_MAX_CONNS", 20),
			MinConns:    envInt32("DATABASE_MIN_CONNS", 2),
			MaxConnIdle: getEnvDuration("DATABASE_MAX_CONN_IDLE", 5*time.Minute),
		},
		Redis: RedisConfig{
			URL:      getEnv("REDIS_URL", ""),
			Addr:     getEnv("REDIS_ADDR", "localhost:6380"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getEnvInt("REDIS_DB", 0),
			Required: getEnvBool("REDIS_REQUIRED", isProd),
		},
		Cache: CacheConfig{
			KeyPrefix:         getEnv("CACHE_KEY_PREFIX", ""),
			DefaultTTL:        getEnvDuration("CACHE_DEFAULT_TTL", 5*time.Minute),
			TokenBlacklistTTL: getEnvDuration("CACHE_TOKEN_BLACKLIST_TTL", 15*time.Minute),
			RefreshTokenTTL:   getEnvDuration("CACHE_REFRESH_TOKEN_TTL", 7*24*time.Hour),
			UserSettingsTTL:   getEnvDuration("CACHE_USER_SETTINGS_TTL", 10*time.Minute),
			AppSettingsTTL:    getEnvDuration("CACHE_APP_SETTINGS_TTL", 30*time.Minute),
			ProductReleaseTTL: getEnvDuration("CACHE_PRODUCT_RELEASE_TTL", 5*time.Minute),
		},
		RabbitMQ: RabbitMQConfig{
			URL:      getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5673/"),
			Enabled:  getEnvBool("RABBITMQ_ENABLED", true),
			Exchange: getEnv("RABBITMQ_EXCHANGE", "masterfabric.events"),
		},
		JWT: JWTConfig{
			Secret:                  getEnv("JWT_SECRET", defaultJWTSecret),
			AccessTokenTTL:          getEnvDuration("JWT_ACCESS_TTL", 5*time.Minute),
			RefreshTokenTTL:         getEnvDuration("JWT_REFRESH_TTL", 7*24*time.Hour),
			MaxRefreshTokensPerUser: getEnvInt("AUTH_MAX_REFRESH_SESSIONS_PER_USER", 10),
		},
		Log: LogConfig{
			Level:  getEnv("LOG_LEVEL", logLevelDefault),
			Format: getEnv("LOG_FORMAT", "json"),
		},
		GraphQL: GraphQLConfig{
			Introspection:   getEnvBool("GRAPHQL_INTROSPECTION", !isProd),
			Playground:      getEnvBool("GRAPHQL_PLAYGROUND", !isProd),
			QueryDepthLimit: getEnvInt("GRAPHQL_QUERY_DEPTH_LIMIT", 15),
			ComplexityLimit: getEnvInt("GRAPHQL_COMPLEXITY_LIMIT", 300),
		},
		CORS: CORSConfig{
			AllowedOrigins: parseCORSOrigins(getEnv("CORS_ALLOWED_ORIGINS", "*")),
		},
		OTP:                   loadOTPConfig(),
		SMTP:                  loadSMTPConfig(),
		MailSMTPEncryptionKey: loadMailSMTPEncryptionKey(),
		WhatsApp:              loadWhatsAppConfig(),
		Telegram:              loadTelegramConfig(),
		OneSignal:             loadOneSignalConfig(),
	}
}

func loadOneSignalConfig() OneSignalConfig {
	return OneSignalConfig{
		AppID:      strings.TrimSpace(getEnv("ONESIGNAL_APP_ID", "")),
		RESTAPIKey: strings.TrimSpace(getEnv("ONESIGNAL_REST_API_KEY", "")),
	}
}

func loadOTPConfig() OTPConfig {
	delivery := strings.ToLower(strings.TrimSpace(getEnv("OTP_DELIVERY", "admin_panel")))
	appName := strings.TrimSpace(getEnv("OTP_APP_NAME", ""))
	if appName == "" {
		appName = strings.TrimSpace(getEnv("SMTP_SUBJECT_PREFIX", ""))
	}
	if appName == "" {
		appName = "MasterFabric"
	}
	return OTPConfig{Delivery: delivery, AppName: appName}
}

func loadWhatsAppConfig() WhatsAppConfig {
	ver := strings.TrimSpace(getEnv("WHATSAPP_API_VERSION", ""))
	if ver == "" {
		ver = "v21.0"
	}
	return WhatsAppConfig{
		AccessToken:   strings.TrimSpace(getEnv("WHATSAPP_ACCESS_TOKEN", "")),
		PhoneNumberID: strings.TrimSpace(getEnv("WHATSAPP_PHONE_NUMBER_ID", "")),
		APIVersion:    ver,
	}
}

func loadTelegramConfig() TelegramConfig {
	return TelegramConfig{
		BotToken: strings.TrimSpace(getEnv("TELEGRAM_BOT_TOKEN", "")),
	}
}

func loadSMTPConfig() SMTPConfig {
	host := strings.TrimSpace(getEnv("SMTP_HOST", ""))
	if host == "" {
		return SMTPConfig{}
	}
	prefix := getEnv("SMTP_SUBJECT_PREFIX", "MasterFabric")
	if prefix == "" {
		prefix = "MasterFabric"
	}
	return SMTPConfig{
		Host:          host,
		Port:          getEnvInt("SMTP_PORT", 587),
		Username:      getEnv("SMTP_USER", ""),
		Password:      getEnv("SMTP_PASSWORD", ""),
		From:          strings.TrimSpace(getEnv("SMTP_FROM", "")),
		FromName:      strings.TrimSpace(getEnv("SMTP_FROM_NAME", "")),
		SubjectPrefix: prefix,
		ImplicitTLS:   getEnvBool("SMTP_IMPLICIT_TLS", false),
		PlainNoTLS:    getEnvBool("SMTP_PLAIN_NO_TLS", false),
	}
}

// loadMailSMTPEncryptionKey parses MAIL_SMTP_ENCRYPTION_KEY: base64 (32 raw bytes)
// or 64 hex chars. Empty env → nil (passwords stored plaintext in Postgres — dev only).
func loadMailSMTPEncryptionKey() []byte {
	raw := strings.TrimSpace(getEnv("MAIL_SMTP_ENCRYPTION_KEY", ""))
	if raw == "" {
		return nil
	}
	if b, err := base64.StdEncoding.DecodeString(raw); err == nil && len(b) == 32 {
		return b
	}
	if b, err := base64.RawStdEncoding.DecodeString(raw); err == nil && len(b) == 32 {
		return b
	}
	if len(raw) == 64 {
		if b, err := hex.DecodeString(raw); err == nil && len(b) == 32 {
			return b
		}
	}
	fmt.Println("[SECURITY WARNING] MAIL_SMTP_ENCRYPTION_KEY is set but must decode to exactly 32 bytes (AES-256). Use: openssl rand -base64 32. Ignoring — DB passwords will stay plaintext until fixed.")
	return nil
}

// Validate checks configuration invariants and terminates if production-critical
// settings are insecure. Call after Load().
func (c *Config) Validate() {
	if c.JWT.Secret == defaultJWTSecret || len(c.JWT.Secret) < minJWTSecretLen {
		if c.IsProduction() {
			log.Fatalf("FATAL: JWT_SECRET is insecure (default or shorter than %d chars). Set a strong secret for production.", minJWTSecretLen)
		}
		fmt.Printf("[SECURITY WARNING] JWT_SECRET is insecure (default or shorter than %d chars). Set a strong secret before deploying.\n", minJWTSecretLen)
	}

	if c.IsProduction() && strings.Contains(c.Database.DSN, "sslmode=disable") {
		log.Fatalf("FATAL: DATABASE_DSN uses sslmode=disable in production. Use sslmode=require or verify-full.")
	}

	if c.IsProduction() && len(c.MailSMTPEncryptionKey) != 32 {
		fmt.Println("[SECURITY WARNING] Set MAIL_SMTP_ENCRYPTION_KEY (32-byte AES key, e.g. openssl rand -base64 32) so admin SMTP passwords in system_mail_smtp are encrypted at rest.")
	}

	if c.IsProduction() {
		for _, o := range c.CORS.AllowedOrigins {
			if o == "*" {
				log.Fatalf("FATAL: CORS_ALLOWED_ORIGINS must not be \"*\" in production. Set explicit origins (comma-separated).")
			}
		}
		u, err := url.Parse(c.RabbitMQ.URL)
		if err == nil && u.User != nil {
			uuser := u.User.Username()
			pass, _ := u.User.Password()
			if uuser == "guest" && pass == "guest" {
				log.Fatalf("FATAL: RABBITMQ_URL uses default guest:guest in production. Create a dedicated user and vhost.")
			}
		}
	}

	otpMode := strings.ToLower(strings.TrimSpace(c.OTP.Delivery))
	// OTP email/both SMTP completeness is validated after DB init (see mail usecase.ValidateOTPEmailSMTP).
	if otpMode == "whatsapp" || otpMode == "whatsapp_both" {
		if !c.WhatsApp.IsConfigured() {
			if c.IsProduction() {
				log.Fatalf("FATAL: OTP_DELIVERY=%s requires WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.", c.OTP.Delivery)
			}
			fmt.Println("[SECURITY WARNING] OTP_DELIVERY is whatsapp* but WhatsApp Cloud API env is incomplete. OTP will fall back to admin_panel at runtime.")
		}
	}
	if otpMode == "telegram" || otpMode == "telegram_both" {
		if !c.Telegram.IsConfigured() {
			if c.IsProduction() {
				log.Fatalf("FATAL: OTP_DELIVERY=%s requires TELEGRAM_BOT_TOKEN.", c.OTP.Delivery)
			}
			fmt.Println("[SECURITY WARNING] OTP_DELIVERY is telegram* but TELEGRAM_BOT_TOKEN is missing. OTP will fall back to admin_panel at runtime.")
		}
	}
}

func parseCORSOrigins(raw string) []string {
	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	return origins
}

func envInt32(key string, fallback int) int32 {
	v := getEnvInt(key, fallback)
	if v > math.MaxInt32 {
		return math.MaxInt32
	}
	if v < math.MinInt32 {
		return math.MinInt32
	}
	return int32(v)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// portFromEnv returns PORT if set (e.g. by Render), else SERVER_PORT, else 8080.
func portFromEnv() int {
	if p := getEnvInt("PORT", 0); p != 0 {
		return p
	}
	return getEnvInt("SERVER_PORT", 8080)
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return fallback
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}
