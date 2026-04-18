package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/auth/dto"
	otpDTO "github.com/masterfabric/masterfabric_go_basic/internal/application/otp/dto"
	otpUC "github.com/masterfabric/masterfabric_go_basic/internal/application/otp/usecase"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/event"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/model"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	otpRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/repository"
	settingsRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/settings/repository"
	infraAuth "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/auth"
	infraRedis "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/redis"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/events"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/validation"
)

// LoginUseCase authenticates a user by email/password.
// When OTP is enabled for the user, it returns a temporary login token
// instead of full auth tokens; the client must then call LoginVerifyOTPUseCase.
type LoginUseCase struct {
	userRepo     repository.UserRepository
	settingsRepo settingsRepo.UserSettingsRepository
	jwtSvc       *infraAuth.JWTService
	eventBus     events.EventBus
	cache        *infraRedis.CacheHandler
	requestOTP   *otpUC.RequestOTPUseCase
}

// NewLoginUseCase constructs a LoginUseCase.
func NewLoginUseCase(
	userRepo repository.UserRepository,
	settingsRepo settingsRepo.UserSettingsRepository,
	jwtSvc *infraAuth.JWTService,
	eventBus events.EventBus,
	cache *infraRedis.CacheHandler,
	requestOTP *otpUC.RequestOTPUseCase,
) *LoginUseCase {
	return &LoginUseCase{
		userRepo:     userRepo,
		settingsRepo: settingsRepo,
		jwtSvc:       jwtSvc,
		eventBus:     eventBus,
		cache:        cache,
		requestOTP:   requestOTP,
	}
}

const (
	loginFailMaxPerEmail = 20
	loginFailMaxPerIP    = 80
	loginFailWindow      = 15 * time.Minute
)

func (uc *LoginUseCase) recordFailedLogin(ctx context.Context, email, clientIP string) {
	if !uc.cache.Available() {
		return
	}
	_, _ = uc.cache.IncrWithExpiry(ctx, infraRedis.LoginRateLimitEmailKey(email), loginFailWindow)
	if clientIP != "" {
		_, _ = uc.cache.IncrWithExpiry(ctx, infraRedis.LoginRateLimitIPKey(clientIP), loginFailWindow)
	}
}

func (uc *LoginUseCase) clearLoginRateLimits(ctx context.Context, email, clientIP string) {
	if !uc.cache.Available() {
		return
	}
	_ = uc.cache.Del(ctx, infraRedis.LoginRateLimitEmailKey(email))
	if clientIP != "" {
		_ = uc.cache.Del(ctx, infraRedis.LoginRateLimitIPKey(clientIP))
	}
}

// Execute validates credentials. If OTP is enabled, returns OTPRequired=true
// with a temporary loginToken. Otherwise returns full auth tokens.
func (uc *LoginUseCase) Execute(ctx context.Context, req *dto.LoginRequest) (*dto.LoginResponse, error) {
	if err := validation.Struct(req); err != nil {
		return nil, err
	}

	if uc.cache.Available() {
		ek := infraRedis.LoginRateLimitEmailKey(req.Email)
		if n, ok, err := uc.cache.GetInt64(ctx, ek); err == nil && ok && n >= loginFailMaxPerEmail {
			return nil, domainErr.ErrLoginRateLimited
		}
		if req.ClientIP != "" {
			ik := infraRedis.LoginRateLimitIPKey(req.ClientIP)
			if n, ok, err := uc.cache.GetInt64(ctx, ik); err == nil && ok && n >= loginFailMaxPerIP {
				return nil, domainErr.ErrLoginRateLimited
			}
		}
	}

	user, err := uc.userRepo.FindByEmail(ctx, req.Email)
	if err != nil || user == nil {
		uc.recordFailedLogin(ctx, req.Email, req.ClientIP)
		return nil, domainErr.ErrInvalidCredentials
	}

	if err := infraAuth.CheckPassword(req.Password, user.PasswordHash); err != nil {
		uc.recordFailedLogin(ctx, req.Email, req.ClientIP)
		return nil, domainErr.ErrInvalidCredentials
	}

	if user.Status != model.UserStatusActive {
		uc.recordFailedLogin(ctx, req.Email, req.ClientIP)
		return nil, domainErr.ErrAccountDisabled
	}

	userData := dto.UserData{
		ID:          user.ID.String(),
		Email:       user.Email,
		DisplayName: user.DisplayName,
		AvatarURL:   user.AvatarURL,
		Role:        string(user.Role),
	}

	// Check if OTP is enabled for this user
	settings, _ := uc.settingsRepo.FindByUserID(ctx, user.ID)
	if settings != nil && settings.OTPEnabled {
		if !uc.cache.Available() {
			return nil, domainErr.New("OTP_UNAVAILABLE", "sign-in verification requires the session cache", nil)
		}
		if uc.requestOTP == nil {
			return nil, domainErr.New("OTP_UNAVAILABLE", "OTP service is not configured", nil)
		}

		loginToken := uuid.New().String()
		key := infraRedis.OTPCodeKey(user.ID.String(), "login_pending")
		reverseKey := fmt.Sprintf("mf:otp:login_token:%s", loginToken)
		_ = uc.cache.Set(ctx, key, loginToken, 5*time.Minute)
		_ = uc.cache.Set(ctx, reverseKey, user.ID.String(), 5*time.Minute)

		// Auto-generate OTP (DB row + optional delivery). Must not return otpRequired if this fails,
		// or the client shows the code sheet with nothing to verify (OTP_NOT_FOUND on submit).
		if _, err := uc.requestOTP.Execute(ctx, &otpDTO.RequestOTPRequest{
			UserID:  user.ID.String(),
			Purpose: "login",
		}); err != nil {
			_ = uc.cache.Del(ctx, key, reverseKey)
			return nil, err
		}

		uc.clearLoginRateLimits(ctx, req.Email, req.ClientIP)

		return &dto.LoginResponse{
			OTPRequired: true,
			LoginToken:  loginToken,
			User:        userData,
		}, nil
	}

	// No OTP — issue tokens directly
	pair, err := uc.jwtSvc.GenerateTokenPair(ctx, user.ID, user.Email, string(user.Role))
	if err != nil {
		return nil, fmt.Errorf("login: generate tokens: %w", err)
	}

	_ = uc.eventBus.Publish(ctx, events.TopicUserLoggedIn, events.Event{
		Type: event.EventUserLoggedIn,
		Payload: event.UserLoggedInPayload{
			UserID:   user.ID.String(),
			Email:    user.Email,
			LoggedAt: time.Now().UTC(),
		},
	})

	uc.clearLoginRateLimits(ctx, req.Email, req.ClientIP)

	return &dto.LoginResponse{
		OTPRequired:  false,
		AccessToken:  pair.AccessToken,
		RefreshToken: pair.RefreshToken,
		ExpiresIn:    pair.ExpiresIn,
		User:         userData,
	}, nil
}

// LoginVerifyOTPUseCase completes OTP-based login.
type LoginVerifyOTPUseCase struct {
	userRepo repository.UserRepository
	otpRepo  otpRepo.OTPRepository
	jwtSvc   *infraAuth.JWTService
	eventBus events.EventBus
	cache    *infraRedis.CacheHandler
}

func NewLoginVerifyOTPUseCase(
	userRepo repository.UserRepository,
	otpRepo otpRepo.OTPRepository,
	jwtSvc *infraAuth.JWTService,
	eventBus events.EventBus,
	cache *infraRedis.CacheHandler,
) *LoginVerifyOTPUseCase {
	return &LoginVerifyOTPUseCase{
		userRepo: userRepo,
		otpRepo:  otpRepo,
		jwtSvc:   jwtSvc,
		eventBus: eventBus,
		cache:    cache,
	}
}

func (uc *LoginVerifyOTPUseCase) Execute(ctx context.Context, req *dto.LoginVerifyOTPRequest) (*dto.AuthResponse, error) {
	if err := validation.Struct(req); err != nil {
		return nil, err
	}

	// Find the user associated with this login token by scanning pending login tokens.
	// The loginToken is stored as value in Redis under mf:otp:<userID>:login_pending.
	// We need to verify the OTP code against the user's pending OTP.
	// For efficiency, the loginToken itself encodes the userID via a lookup key.
	if !uc.cache.Available() {
		return nil, domainErr.New("OTP_UNAVAILABLE", "OTP verification requires cache service", nil)
	}

	// Lookup: loginToken -> userID via reverse key
	reverseKey := fmt.Sprintf("mf:otp:login_token:%s", req.LoginToken)
	userIDStr, found, err := uc.cache.Get(ctx, reverseKey)
	if err != nil || !found {
		return nil, domainErr.ErrTokenInvalid
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, domainErr.ErrTokenInvalid
	}

	// Verify OTP code
	verifyReq := &otpDTO.VerifyOTPRequest{
		UserID:  userID.String(),
		Code:    req.Code,
		Purpose: "login",
	}
	_ = verifyReq // We verify via the OTP repo directly

	otp, err := uc.otpRepo.FindPendingByUserID(ctx, userID, "login")
	if err != nil || otp == nil {
		return nil, domainErr.New("OTP_NOT_FOUND", "no pending OTP found", nil)
	}
	if otp.IsExpired() {
		_ = uc.otpRepo.MarkExpired(ctx, otp.ID)
		return nil, domainErr.New("OTP_EXPIRED", "OTP code has expired", nil)
	}
	if otp.IsMaxAttemptsReached() {
		_ = uc.otpRepo.MarkExpired(ctx, otp.ID)
		return nil, domainErr.New("OTP_MAX_ATTEMPTS", "maximum verification attempts exceeded", nil)
	}

	_ = uc.otpRepo.IncrementAttempts(ctx, otp.ID)

	if otp.Code != req.Code {
		remaining := otp.MaxRetries - otp.Attempts - 1
		return nil, domainErr.New("OTP_INVALID", fmt.Sprintf("invalid code, %d attempts remaining", remaining), nil)
	}

	_ = uc.otpRepo.MarkVerified(ctx, otp.ID)
	_ = uc.cache.Del(ctx, reverseKey)
	_ = uc.cache.Del(ctx, infraRedis.OTPCodeKey(userID.String(), "login_pending"))

	// Fetch user and issue tokens
	user, err := uc.userRepo.FindByID(ctx, userID)
	if err != nil || user == nil {
		return nil, domainErr.ErrUserNotFound
	}

	pair, err := uc.jwtSvc.GenerateTokenPair(ctx, user.ID, user.Email, string(user.Role))
	if err != nil {
		return nil, fmt.Errorf("loginVerifyOTP: generate tokens: %w", err)
	}

	_ = uc.eventBus.Publish(ctx, events.TopicUserLoggedIn, events.Event{
		Type: event.EventUserLoggedIn,
		Payload: event.UserLoggedInPayload{
			UserID:   user.ID.String(),
			Email:    user.Email,
			LoggedAt: time.Now().UTC(),
		},
	})

	return &dto.AuthResponse{
		AccessToken:  pair.AccessToken,
		RefreshToken: pair.RefreshToken,
		ExpiresIn:    pair.ExpiresIn,
		User: dto.UserData{
			ID:          user.ID.String(),
			Email:       user.Email,
			DisplayName: user.DisplayName,
			AvatarURL:   user.AvatarURL,
			Role:        string(user.Role),
		},
	}, nil
}
