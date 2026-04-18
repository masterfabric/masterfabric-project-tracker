package usecase

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/user/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/event"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/model"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	otpModel "github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/model"
	otprepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/repository"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/events"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/validation"
)

// GetProfileUseCase returns the user profile for the given user ID.
type GetProfileUseCase struct {
	userRepo repository.UserRepository
}

// NewGetProfileUseCase constructs a GetProfileUseCase.
func NewGetProfileUseCase(userRepo repository.UserRepository) *GetProfileUseCase {
	return &GetProfileUseCase{userRepo: userRepo}
}

// Execute fetches the profile.
func (uc *GetProfileUseCase) Execute(ctx context.Context, userID string) (*dto.UserProfileResponse, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, domainErr.ErrUserNotFound
	}

	user, err := uc.userRepo.FindByID(ctx, id)
	if err != nil || user == nil {
		return nil, domainErr.ErrUserNotFound
	}

	return userToProfileResponse(user), nil
}

const emailChangeOTPConsumptionWindow = 15 * time.Minute

// UpdateProfileUseCase modifies mutable user fields.
type UpdateProfileUseCase struct {
	userRepo repository.UserRepository
	otpRepo  otprepo.OTPRepository
	eventBus events.EventBus
}

// NewUpdateProfileUseCase constructs an UpdateProfileUseCase.
func NewUpdateProfileUseCase(userRepo repository.UserRepository, otpRepo otprepo.OTPRepository, eventBus events.EventBus) *UpdateProfileUseCase {
	return &UpdateProfileUseCase{userRepo: userRepo, otpRepo: otpRepo, eventBus: eventBus}
}

// Execute applies partial updates to a user profile.
func (uc *UpdateProfileUseCase) Execute(ctx context.Context, req *dto.UpdateProfileRequest) (*dto.UserProfileResponse, error) {
	id, err := uuid.Parse(req.UserID)
	if err != nil {
		return nil, domainErr.ErrUserNotFound
	}

	user, err := uc.userRepo.FindByID(ctx, id)
	if err != nil || user == nil {
		return nil, domainErr.ErrUserNotFound
	}

	if err := validation.Struct(req); err != nil {
		return nil, err
	}

	var consumedOtpID *uuid.UUID

	// Apply partial updates — only overwrite fields that were provided
	if req.Email != nil {
		trimmed := strings.TrimSpace(*req.Email)
		normalized := strings.ToLower(trimmed)
		currentNorm := strings.ToLower(strings.TrimSpace(user.Email))
		if normalized != currentNorm {
			otpIDStr := ""
			if req.EmailChangeOtpID != nil {
				otpIDStr = strings.TrimSpace(*req.EmailChangeOtpID)
			}
			if otpIDStr == "" {
				return nil, domainErr.New("EMAIL_CHANGE_OTP_REQUIRED", "verify the code sent to your current email before changing your address", nil)
			}
			otpUUID, perr := uuid.Parse(otpIDStr)
			if perr != nil {
				return nil, domainErr.New("EMAIL_CHANGE_OTP_INVALID", "invalid verification", nil)
			}
			otpRow, oerr := uc.otpRepo.FindByID(ctx, otpUUID)
			if oerr != nil || otpRow == nil {
				return nil, domainErr.New("EMAIL_CHANGE_OTP_INVALID", "invalid or expired verification", nil)
			}
			if otpRow.UserID != id {
				return nil, domainErr.New("EMAIL_CHANGE_OTP_INVALID", "verification does not match this account", nil)
			}
			if otpRow.Purpose != otpModel.OTPPurposeEmailChange {
				return nil, domainErr.New("EMAIL_CHANGE_OTP_INVALID", "wrong verification type", nil)
			}
			if otpRow.Status != otpModel.OTPStatusVerified {
				return nil, domainErr.New("EMAIL_CHANGE_OTP_INVALID", "code not verified yet", nil)
			}
			if otpRow.VerifiedAt == nil {
				return nil, domainErr.New("EMAIL_CHANGE_OTP_INVALID", "invalid verification", nil)
			}
			if time.Since(otpRow.VerifiedAt.UTC()) > emailChangeOTPConsumptionWindow {
				return nil, domainErr.New("EMAIL_CHANGE_OTP_EXPIRED", "verification expired; request a new code", nil)
			}
			other, ferr := uc.userRepo.FindByEmail(ctx, normalized)
			if ferr != nil && !errors.Is(ferr, domainErr.ErrUserNotFound) {
				return nil, fmt.Errorf("check email: %w", ferr)
			}
			if other != nil && other.ID != id {
				return nil, domainErr.ErrEmailTaken
			}
			user.Email = normalized
			consumedOtpID = &otpUUID
		}
	} else if req.EmailChangeOtpID != nil && strings.TrimSpace(*req.EmailChangeOtpID) != "" {
		return nil, domainErr.New("VALIDATION_ERROR", "emailChangeOtpId is only used when updating email", nil)
	}
	if req.DisplayName != nil {
		user.DisplayName = *req.DisplayName
	}
	if req.Nickname != nil {
		trimmed := strings.TrimSpace(*req.Nickname)
		if trimmed != "" {
			exists, err := uc.userRepo.NicknameExists(ctx, trimmed, &id)
			if err != nil {
				return nil, fmt.Errorf("check nickname: %w", err)
			}
			if exists {
				return nil, domainErr.New("NICKNAME_TAKEN", "this nickname is already in use", nil)
			}
		}
		user.Nickname = trimmed
	}
	if req.AvatarURL != nil {
		user.AvatarURL = *req.AvatarURL
	}
	if req.Bio != nil {
		user.Bio = *req.Bio
	}
	if req.PhoneNumber != nil {
		user.PhoneNumber = *req.PhoneNumber
	}
	if req.TelegramChatID != nil {
		user.TelegramChatID = strings.TrimSpace(*req.TelegramChatID)
	}
	if req.DateOfBirth != nil {
		user.DateOfBirth = req.DateOfBirth
	}
	if req.Gender != nil {
		user.Gender = model.UserGender(*req.Gender)
	}
	if req.Location != nil {
		user.Location = *req.Location
	}
	if req.WebsiteURL != nil {
		user.WebsiteURL = *req.WebsiteURL
	}
	if req.SocialTwitter != nil {
		user.SocialTwitter = *req.SocialTwitter
	}
	if req.SocialGitHub != nil {
		user.SocialGitHub = *req.SocialGitHub
	}
	if req.SocialLinkedIn != nil {
		user.SocialLinkedIn = *req.SocialLinkedIn
	}
	if req.Language != nil {
		user.Language = *req.Language
	}
	user.UpdatedAt = time.Now().UTC()

	if err := uc.userRepo.Update(ctx, user); err != nil {
		return nil, fmt.Errorf("update profile: %w", err)
	}

	if consumedOtpID != nil {
		_ = uc.otpRepo.MarkExpired(ctx, *consumedOtpID)
	}

	_ = uc.eventBus.Publish(ctx, events.TopicUserUpdated, events.Event{
		Type:    event.EventUserUpdated,
		Payload: map[string]string{"user_id": user.ID.String()},
	})

	return userToProfileResponse(user), nil
}

// NicknameAvailableUseCase checks if a nickname is available (not taken by another user).
type NicknameAvailableUseCase struct {
	userRepo repository.UserRepository
}

// NewNicknameAvailableUseCase constructs a NicknameAvailableUseCase.
func NewNicknameAvailableUseCase(userRepo repository.UserRepository) *NicknameAvailableUseCase {
	return &NicknameAvailableUseCase{userRepo: userRepo}
}

// Execute returns true if the nickname is available. excludeUserID is optional (e.g. current user when editing).
func (uc *NicknameAvailableUseCase) Execute(ctx context.Context, nickname string, excludeUserID *string) (bool, error) {
	trimmed := strings.TrimSpace(nickname)
	if trimmed == "" || len(trimmed) > 80 {
		return false, nil
	}
	var exclude *uuid.UUID
	if excludeUserID != nil && *excludeUserID != "" {
		id, err := uuid.Parse(*excludeUserID)
		if err != nil {
			return false, nil
		}
		exclude = &id
	}
	exists, err := uc.userRepo.NicknameExists(ctx, trimmed, exclude)
	if err != nil {
		return false, err
	}
	return !exists, nil
}

// DeleteAccountUseCase permanently removes a user.
type DeleteAccountUseCase struct {
	userRepo repository.UserRepository
	eventBus events.EventBus
}

// NewDeleteAccountUseCase constructs a DeleteAccountUseCase.
func NewDeleteAccountUseCase(userRepo repository.UserRepository, eventBus events.EventBus) *DeleteAccountUseCase {
	return &DeleteAccountUseCase{userRepo: userRepo, eventBus: eventBus}
}

// Execute deletes the user account.
func (uc *DeleteAccountUseCase) Execute(ctx context.Context, userID string) error {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domainErr.ErrUserNotFound
	}

	if err := uc.userRepo.Delete(ctx, id); err != nil {
		return fmt.Errorf("delete account: %w", err)
	}

	_ = uc.eventBus.Publish(ctx, events.TopicUserDeleted, events.Event{
		Type:    event.EventUserDeleted,
		Payload: map[string]string{"user_id": userID},
	})
	return nil
}

// userToProfileResponse maps a domain User to the UserProfileResponse DTO.
func userToProfileResponse(u *model.User) *dto.UserProfileResponse {
	return &dto.UserProfileResponse{
		ID:             u.ID.String(),
		Email:          u.Email,
		DisplayName:    u.DisplayName,
		Nickname:       u.Nickname,
		AvatarURL:      u.AvatarURL,
		Bio:            u.Bio,
		Status:         string(u.Status),
		Role:           string(u.Role),
		CreatedAt:      u.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      u.UpdatedAt.Format(time.RFC3339),
		PhoneNumber:    u.PhoneNumber,
		DateOfBirth:    u.DateOfBirth,
		Gender:         string(u.Gender),
		Location:       u.Location,
		WebsiteURL:     u.WebsiteURL,
		SocialTwitter:  u.SocialTwitter,
		SocialGitHub:   u.SocialGitHub,
		SocialLinkedIn: u.SocialLinkedIn,
		Language:       u.Language,
		TelegramChatID: u.TelegramChatID,
	}
}
