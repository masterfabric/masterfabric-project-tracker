package resolver

// This file will not be regenerated automatically.
//
// It serves as dependency injection for your app, add any dependencies you require here.

import (
	adminUC "github.com/masterfabric/masterfabric_go_basic/internal/application/admin/usecase"
	authUC "github.com/masterfabric/masterfabric_go_basic/internal/application/auth/usecase"
	deviceUC "github.com/masterfabric/masterfabric_go_basic/internal/application/device/usecase"
	feedbackUC "github.com/masterfabric/masterfabric_go_basic/internal/application/feedback/usecase"
	mailUC "github.com/masterfabric/masterfabric_go_basic/internal/application/mail/usecase"
	notificationUC "github.com/masterfabric/masterfabric_go_basic/internal/application/notification/usecase"
	organizationUC "github.com/masterfabric/masterfabric_go_basic/internal/application/organization/usecase"
	otpUC "github.com/masterfabric/masterfabric_go_basic/internal/application/otp/usecase"
	productreleaseUC "github.com/masterfabric/masterfabric_go_basic/internal/application/productrelease/usecase"
	settingsUC "github.com/masterfabric/masterfabric_go_basic/internal/application/settings/usecase"
	todosUC "github.com/masterfabric/masterfabric_go_basic/internal/application/todos/usecase"
	userUC "github.com/masterfabric/masterfabric_go_basic/internal/application/user/usecase"
	usermessageUC "github.com/masterfabric/masterfabric_go_basic/internal/application/usermessage/usecase"
	"github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/graphql/broadcaster"
)

// Resolver is the root dependency container wired up in main.
type Resolver struct {
	// Auth
	RegisterUC               *authUC.RegisterUseCase
	LoginUC                  *authUC.LoginUseCase
	LoginVerifyOTPUC         *authUC.LoginVerifyOTPUseCase
	RefreshUC                *authUC.RefreshUseCase
	LogoutUC                 *authUC.LogoutUseCase
	RequestPasswordResetUC   *otpUC.RequestPasswordResetUseCase
	ResetPasswordWithOTPUC   *authUC.ResetPasswordWithOTPUseCase
	// User
	GetProfileUC        *userUC.GetProfileUseCase
	NicknameAvailableUC *userUC.NicknameAvailableUseCase
	UpdateProfileUC     *userUC.UpdateProfileUseCase
	DeleteAccountUC     *userUC.DeleteAccountUseCase
	GetAddressUC        *userUC.GetAddressUseCase
	GetDefaultAddressUC *userUC.GetDefaultAddressUseCase
	UpsertAddressUC     *userUC.UpsertAddressUseCase
	DeleteAddressUC     *userUC.DeleteAddressUseCase
	GetMyAccountDeletionImpactUC *userUC.GetMyAccountDeletionImpactUseCase
	// Settings
	GetUserSettingsUC       *settingsUC.GetUserSettingsUseCase
	UpdateUserSettingsUC    *settingsUC.UpdateUserSettingsUseCase
	GetAppSettingsUC        *settingsUC.GetAppSettingsUseCase
	AdminListAppSettingsUC  *settingsUC.AdminListAppSettingsUseCase
	AdminUpsertAppSettingUC *settingsUC.AdminUpsertAppSettingUseCase
	GetProductReleaseUC         *productreleaseUC.GetProductReleaseUseCase
	AdminUpdateProductReleaseUC *productreleaseUC.AdminUpdateProductReleaseUseCase
	// Feedback (GFG-24)
	SubmitFeedbackUC       *feedbackUC.SubmitFeedbackUseCase
	ListMyFeedbackUC       *feedbackUC.ListMyFeedbackUseCase
	AdminListFeedbackUC    *feedbackUC.AdminListFeedbackUseCase
	AdminReplyToFeedbackUC *feedbackUC.AdminReplyToFeedbackUseCase
	AdminDeleteFeedbackUC  *feedbackUC.AdminDeleteFeedbackUseCase
	// Device
	RegisterDeviceUC *deviceUC.RegisterDeviceUseCase
	ListDevicesUC    *deviceUC.ListDevicesUseCase
	// Todos
	CreateTodoUC *todosUC.CreateTodoUseCase
	ListTodosUC  *todosUC.ListTodosUseCase
	UpdateTodoUC *todosUC.UpdateTodoUseCase
	DeleteTodoUC *todosUC.DeleteTodoUseCase
	ListUserTodoSubtasksUC   *todosUC.ListUserTodoSubtasksUseCase
	CreateUserTodoSubtaskUC  *todosUC.CreateUserTodoSubtaskUseCase
	UpdateUserTodoSubtaskUC  *todosUC.UpdateUserTodoSubtaskUseCase
	DeleteUserTodoSubtaskUC  *todosUC.DeleteUserTodoSubtaskUseCase
	// Organization
	CreateOrganizationUC          *organizationUC.CreateOrganizationUseCase
	InviteToOrganizationUC        *organizationUC.InviteToOrganizationUseCase
	AcceptInvitationUC            *organizationUC.AcceptInvitationUseCase
	DeclineInvitationUC           *organizationUC.DeclineInvitationUseCase
	RevokeOrganizationInvitationUC *organizationUC.RevokeOrganizationInvitationUseCase
	ResendOrganizationInvitationUC *organizationUC.ResendOrganizationInvitationUseCase
	ListOrganizationsUC           *organizationUC.ListOrganizationsUseCase
	ListOrganizationMembersUC     *organizationUC.ListOrganizationMembersUseCase
	ListOrganizationInvitationsUC *organizationUC.ListOrganizationInvitationsUseCase
	ListPendingInvitationsUC      *organizationUC.ListPendingInvitationsUseCase
	GetOrganizationUC             *organizationUC.GetOrganizationUseCase
	UpdateOrganizationUC          *organizationUC.UpdateOrganizationUseCase
	RemoveOrganizationMemberUC    *organizationUC.RemoveOrganizationMemberUseCase
	LeaveOrganizationUC           *organizationUC.LeaveOrganizationUseCase
	SetOrganizationMemberSuspendedUC *organizationUC.SetOrganizationMemberSuspendedUseCase
	ListOrganizationNewsUC        *organizationUC.ListOrganizationNewsUseCase
	CreateOrganizationNewsUC      *organizationUC.CreateOrganizationNewsUseCase
	UpdateOrganizationNewsUC    *organizationUC.UpdateOrganizationNewsUseCase
	DeleteOrganizationNewsUC      *organizationUC.DeleteOrganizationNewsUseCase
	ListOrganizationMessagesUC     *organizationUC.ListOrganizationMessagesUseCase
	PostOrganizationMessageUC      *organizationUC.PostOrganizationMessageUseCase
	DeleteOrganizationMessageUC    *organizationUC.DeleteOrganizationMessageUseCase
	OrganizationMessageBroadcaster *broadcaster.OrganizationMessageBroadcaster
	// Organization projects (GFG-92)
	ListOrganizationProjectsUC         *organizationUC.ListOrganizationProjectsUseCase
	GetOrganizationProjectUC         *organizationUC.GetOrganizationProjectUseCase
	ListOrganizationProjectMembersUC *organizationUC.ListOrganizationProjectMembersUseCase
	ListOrganizationProjectTodosUC   *organizationUC.ListOrganizationProjectTodosUseCase
	CreateOrganizationProjectUC      *organizationUC.CreateOrganizationProjectUseCase
	UpdateOrganizationProjectUC      *organizationUC.UpdateOrganizationProjectUseCase
	DeleteOrganizationProjectUC      *organizationUC.DeleteOrganizationProjectUseCase
	AddOrganizationProjectMemberUC   *organizationUC.AddOrganizationProjectMemberUseCase
	RemoveOrganizationProjectMemberUC *organizationUC.RemoveOrganizationProjectMemberUseCase
	CreateOrganizationProjectTodoUC  *organizationUC.CreateOrganizationProjectTodoUseCase
	UpdateOrganizationProjectTodoUC  *organizationUC.UpdateOrganizationProjectTodoUseCase
	DeleteOrganizationProjectTodoUC  *organizationUC.DeleteOrganizationProjectTodoUseCase
	ListOrganizationProjectTodoSubtasksUC   *organizationUC.ListOrganizationProjectTodoSubtasksUseCase
	CreateOrganizationProjectTodoSubtaskUC *organizationUC.CreateOrganizationProjectTodoSubtaskUseCase
	UpdateOrganizationProjectTodoSubtaskUC *organizationUC.UpdateOrganizationProjectTodoSubtaskUseCase
	DeleteOrganizationProjectTodoSubtaskUC *organizationUC.DeleteOrganizationProjectTodoSubtaskUseCase
	ListOrganizationProjectPurchasesUC   *organizationUC.ListOrganizationProjectPurchasesUseCase
	CreateOrganizationProjectPurchaseUC  *organizationUC.CreateOrganizationProjectPurchaseUseCase
	UpdateOrganizationProjectPurchaseUC  *organizationUC.UpdateOrganizationProjectPurchaseUseCase
	DeleteOrganizationProjectPurchaseUC  *organizationUC.DeleteOrganizationProjectPurchaseUseCase
	CreateOrganizationProjectOrgInviteUC *organizationUC.CreateOrganizationProjectOrgInviteUseCase
	AcceptOrganizationProjectOrgInviteUC *organizationUC.AcceptOrganizationProjectOrgInviteUseCase
	// GFG-174
	OwnerTodoDashboardUC *organizationUC.OwnerTodoDashboardUseCase
	// Notification
	ListNotificationsUC          *notificationUC.ListNotificationsUseCase
	MarkNotificationReadUC       *notificationUC.MarkNotificationReadUseCase
	MarkAllNotificationsReadUC   *notificationUC.MarkAllNotificationsReadUseCase
	AdminCreateNotificationUC    *notificationUC.AdminCreateNotificationUseCase
	AdminClearAllNotificationsUC *notificationUC.AdminClearAllNotificationsUseCase
	AdminDeleteNotificationUC    *notificationUC.AdminDeleteNotificationUseCase
	AdminUpdateNotificationUC    *notificationUC.AdminUpdateNotificationUseCase
	// Admin
	ListUsersUC             *adminUC.ListUsersUseCase
	GetUserByIDUC           *adminUC.GetUserByIDUseCase
	SuspendUserUC           *adminUC.SuspendUserUseCase
	ChangeRoleUC            *adminUC.ChangeUserRoleUseCase
	SetUserStatusUC         *adminUC.SetUserStatusUseCase
	DeleteUserUC            *adminUC.DeleteUserUseCase
	GetUserDeletionImpactUC *adminUC.GetUserDeletionImpactUseCase
	ListUserSessionsUC      *adminUC.ListUserSessionsUseCase
	GetSessionStatsUC            *adminUC.GetSessionStatsUseCase
	AdminListUserOwnedTodosUC    *adminUC.AdminListUserOwnedTodosUseCase
	AdminDeleteUserTodoUC        *adminUC.AdminDeleteUserTodoUseCase
	AdminUpdateUserTodoUC        *adminUC.AdminUpdateUserTodoUseCase
	// User messages (snackbar, real-time)
	ListUserMessagesUC       *usermessageUC.ListUserMessagesUseCase
	AdminCreateUserMessageUC *usermessageUC.AdminCreateUserMessageUseCase
	MarkUserMessageReadUC    *usermessageUC.MarkUserMessageReadUseCase
	AdminDeleteUserMessageUC *usermessageUC.AdminDeleteUserMessageUseCase
	UserMessageBroadcaster   *broadcaster.UserMessageBroadcaster
	// OTP
	RequestOTPUC           *otpUC.RequestOTPUseCase
	VerifyOTPUC            *otpUC.VerifyOTPUseCase
	AdminListPendingOTPsUC *otpUC.AdminListPendingOTPsUseCase
	AdminUserOTPHistoryUC  *otpUC.AdminUserOTPHistoryUseCase
	// Mail (admin SMTP)
	GetAdminMailSMTPSettingsUC    *mailUC.GetAdminMailSMTPSettingsUseCase
	UpdateAdminMailSMTPSettingsUC *mailUC.UpdateAdminMailSMTPSettingsUseCase
	AdminSendTestMailUC           *mailUC.AdminSendTestMailUseCase
	AdminSendUserEmailUC          *mailUC.AdminSendUserEmailUseCase
}
