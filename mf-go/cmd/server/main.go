package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/99designs/gqlgen/graphql"
	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/lru"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
	"github.com/joho/godotenv"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"

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
	infraAuth "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/auth"
	"github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/graphql/broadcaster"
	"github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/graphql/generated"
	"github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/graphql/resolver"
	"github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/onesignal"
	infraOTP "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/otp"
	adminPG "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/postgres/admin"
	devicePG "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/postgres/device"
	feedbackPG "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/postgres/feedback"
	iamPG "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/postgres/iam"
	mailPG "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/postgres/mail"
	"github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/postgres/migrations"
	notificationPG "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/postgres/notification"
	organizationPG "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/postgres/organization"
	otpPG "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/postgres/otp"
	productreleasePG "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/postgres/productrelease"
	sessionPG "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/postgres/session"
	settingsPG "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/postgres/settings"
	todosPG "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/postgres/todos"
	usermessagePG "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/postgres/usermessage"
	"github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/rabbitmq"
	infraRedis "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/redis"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/cache"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/config"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/database"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/events"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/graphqldepth"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/health"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/httpctx"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/logger"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/middleware"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/version"
)

func main() {
	// Load `.env` from the process working directory (e.g. mf-go/). `make run` and Air
	// execute the binary directly without shell-sourcing `.env`, so vars like REDIS_PASSWORD apply here.
	_ = godotenv.Load()

	// ── Config ──────────────────────────────────────────────────────────────
	cfg := config.Load()
	cfg.Validate()
	log := logger.New(cfg.Log.Level, cfg.Log.Format)
	slog.SetDefault(log)

	log.Info("starting service",
		slog.String("service", version.ServiceName),
		slog.String("version", version.Version),
		slog.String("env", cfg.Env),
	)

	// ── Database ────────────────────────────────────────────────────────────
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pool, err := database.NewPostgresPool(ctx, cfg.Database)
	if err != nil {
		log.Error("failed to connect to postgres", slog.Any("error", err))
		os.Exit(1)
	}
	defer pool.Close()

	// ── Migrations ──────────────────────────────────────────────────────────
	if err := migrations.Run(cfg.Database.DSN, log); err != nil {
		log.Error("failed to run migrations", slog.Any("error", err))
		os.Exit(1)
	}

	// ── Redis ───────────────────────────────────────────────────────────────
	redisClient, err := cache.NewRedisClient(ctx, cfg.Redis)
	if err != nil {
		if cfg.Redis.Required {
			log.Error("redis is required but unavailable", slog.Any("error", err))
			os.Exit(1)
		}
		log.Warn("redis unavailable — token blacklisting, refresh storage, and logout will be degraded", slog.Any("error", err))
	}
	cacheHandler := infraRedis.NewCacheHandler(redisClient)

	// ── Event bus ───────────────────────────────────────────────────────────
	var eventBus events.EventBus
	if cfg.RabbitMQ.Enabled {
		const maxRabbitConnectAttempts = 30
		const rabbitRetryDelay = 1 * time.Second

		var bus *rabbitmq.Bus
		var busErr error
		for attempt := 1; attempt <= maxRabbitConnectAttempts; attempt++ {
			bus, busErr = rabbitmq.NewBus(cfg.RabbitMQ.URL, cfg.RabbitMQ.Exchange, log)
			if busErr == nil {
				break
			}

			if attempt < maxRabbitConnectAttempts {
				log.Warn(
					"rabbitmq not ready yet — retrying",
					slog.Int("attempt", attempt),
					slog.Int("max_attempts", maxRabbitConnectAttempts),
					slog.Any("error", busErr),
				)
				time.Sleep(rabbitRetryDelay)
			}
		}

		if busErr != nil {
			log.Warn("rabbitmq unavailable — using in-process bus", slog.Any("error", busErr))
			eventBus = rabbitmq.NewInProcessBus(log)
		} else {
			eventBus = bus
			defer bus.Close()
			log.Info("rabbitmq connected")
		}
	} else {
		log.Info("rabbitmq disabled — using in-process bus")
		eventBus = rabbitmq.NewInProcessBus(log)
	}

	// ── Infrastructure ──────────────────────────────────────────────────────
	userRepo := iamPG.NewUserRepo(pool)
	userSettingsRepo := settingsPG.NewUserSettingsRepo(pool)
	appSettingsRepo := settingsPG.NewAppSettingsRepo(pool)
	productReleaseRepo := productreleasePG.NewRepo(pool)
	deviceRepo := devicePG.NewDeviceRepo(pool)
	organizationRepo := organizationPG.NewOrganizationRepo(pool)
	todoRepo := todosPG.NewTodoRepo(pool)
	notificationRepo := notificationPG.NewNotificationRepo(pool)
	sessionRepo := sessionPG.NewSessionRepo(pool)
	userMessageRepo := usermessagePG.NewUserMessageRepo(pool)
	feedbackRepo := feedbackPG.NewRepo(pool)
	userDeletionImpactRepo := adminPG.NewUserDeletionImpactRepo(pool)
	mailSMTPRepo := mailPG.NewMailSMTPRepo(pool, cfg.MailSMTPEncryptionKey)
	effectiveSMTPResolver := mailUC.NewEffectiveSMTPResolver(mailSMTPRepo, cfg, cacheHandler, cfg.Cache.KeyPrefix)

	readinessCtx, readinessCancel := context.WithTimeout(context.Background(), 5*time.Second)
	mailUC.ValidateOTPEmailSMTP(readinessCtx, cfg, effectiveSMTPResolver)
	readinessCancel()

	otpRepo := otpPG.NewOTPRepo(pool)
	baseOTPProvider := infraOTP.NewDeliveryProvider(cfg, log, userRepo, effectiveSMTPResolver, appSettingsRepo)
	emailOTPProvider := infraOTP.NewEmailDeliveryProvider(log, userRepo, effectiveSMTPResolver, cfg.OTP.AppName, appSettingsRepo)
	otpProvider := infraOTP.WithUserFacingOTPSMTP(baseOTPProvider, emailOTPProvider, effectiveSMTPResolver, log)

	jwtSvc := infraAuth.NewJWTService(cfg.JWT, cacheHandler, log)
	userMessageBroadcaster := broadcaster.NewUserMessageBroadcaster()
	orgMessageBroadcaster := broadcaster.NewOrganizationMessageBroadcaster()
	getProfileUC := userUC.NewGetProfileUseCase(userRepo)

	osClient := &onesignal.Client{AppID: cfg.OneSignal.AppID, RESTAPIKey: cfg.OneSignal.RESTAPIKey, Log: log}
	todoOneSignal := onesignal.NewTodoNotifier(osClient, cacheHandler, cfg.Cache.KeyPrefix, userSettingsRepo, userRepo, log)
	projectOrgInvitePush := onesignal.NewProjectOrgInviteNotifier(osClient, userSettingsRepo, log)
	if todoOneSignal == nil {
		log.Info("onesignal task push disabled (set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY to enable)")
	} else {
		log.Info("onesignal task push enabled (assignment + due reminders)")
	}
	if err := eventBus.Subscribe(events.TopicPushAdminBroadcast, onesignal.AdminBroadcastPushHandler(osClient, log)); err != nil {
		log.Warn("subscribe push.admin.broadcast failed", slog.Any("error", err))
	}
	adminCreateUserMsgUC := usermessageUC.NewAdminCreateUserMessageUseCase(userMessageRepo)
	adminRevokeCoord := adminUC.NewRevokeUserAccessCoordinator(jwtSvc, sessionRepo, adminCreateUserMsgUC)

	// ── OTP use cases (needed by login) ─────────────────────────────────────
	requestOTPUC := otpUC.NewRequestOTPUseCase(otpRepo, otpProvider, cacheHandler)
	verifyOTPUC := otpUC.NewVerifyOTPUseCase(otpRepo, cacheHandler)
	requestPasswordResetUC := otpUC.NewRequestPasswordResetUseCase(userRepo, requestOTPUC, cacheHandler)
	resetPasswordWithOTPUC := authUC.NewResetPasswordWithOTPUseCase(userRepo, verifyOTPUC, jwtSvc, sessionRepo)

	// ── Resolver (DI root) ──────────────────────────────────────────────────
	res := &resolver.Resolver{
		RegisterUC:             authUC.NewRegisterUseCase(userRepo, jwtSvc, eventBus),
		LoginUC:                authUC.NewLoginUseCase(userRepo, userSettingsRepo, jwtSvc, eventBus, cacheHandler, requestOTPUC),
		LoginVerifyOTPUC:       authUC.NewLoginVerifyOTPUseCase(userRepo, otpRepo, jwtSvc, eventBus, cacheHandler),
		RefreshUC:              authUC.NewRefreshUseCase(userRepo, jwtSvc, sessionRepo),
		LogoutUC:               authUC.NewLogoutUseCase(jwtSvc),
		RequestPasswordResetUC: requestPasswordResetUC,
		ResetPasswordWithOTPUC: resetPasswordWithOTPUC,

		GetProfileUC:                 getProfileUC,
		NicknameAvailableUC:          userUC.NewNicknameAvailableUseCase(userRepo),
		UpdateProfileUC:              userUC.NewUpdateProfileUseCase(userRepo, otpRepo, eventBus),
		DeleteAccountUC:              userUC.NewDeleteAccountUseCase(userRepo, eventBus),
		GetMyAccountDeletionImpactUC: userUC.NewGetMyAccountDeletionImpactUseCase(userDeletionImpactRepo),
		GetAddressUC:                 userUC.NewGetAddressUseCase(userRepo),
		GetDefaultAddressUC:          userUC.NewGetDefaultAddressUseCase(userRepo),
		UpsertAddressUC:              userUC.NewUpsertAddressUseCase(userRepo),
		DeleteAddressUC:              userUC.NewDeleteAddressUseCase(userRepo),

		GetUserSettingsUC: settingsUC.NewGetUserSettingsUseCase(
			userSettingsRepo, cacheHandler, cfg.Cache.KeyPrefix, cfg.Cache.UserSettingsTTL,
		),
		UpdateUserSettingsUC: settingsUC.NewUpdateUserSettingsUseCase(
			userSettingsRepo, eventBus, cacheHandler, cfg.Cache.KeyPrefix,
		),
		GetAppSettingsUC: settingsUC.NewGetAppSettingsUseCase(
			appSettingsRepo, cacheHandler, cfg.Cache.KeyPrefix, cfg.Cache.AppSettingsTTL,
		),
		AdminListAppSettingsUC: settingsUC.NewAdminListAppSettingsUseCase(appSettingsRepo),
		AdminUpsertAppSettingUC: settingsUC.NewAdminUpsertAppSettingUseCase(
			appSettingsRepo, cacheHandler, cfg.Cache.KeyPrefix,
		),
		GetProductReleaseUC: productreleaseUC.NewGetProductReleaseUseCase(
			productReleaseRepo, cacheHandler, cfg.Cache.KeyPrefix, cfg.Cache.ProductReleaseTTL,
		),
		AdminUpdateProductReleaseUC: productreleaseUC.NewAdminUpdateProductReleaseUseCase(
			productReleaseRepo, cacheHandler, cfg.Cache.KeyPrefix,
		),

		SubmitFeedbackUC:       feedbackUC.NewSubmitFeedbackUseCase(feedbackRepo),
		ListMyFeedbackUC:       feedbackUC.NewListMyFeedbackUseCase(feedbackRepo),
		AdminListFeedbackUC:    feedbackUC.NewAdminListFeedbackUseCase(feedbackRepo),
		AdminReplyToFeedbackUC: feedbackUC.NewAdminReplyToFeedbackUseCase(feedbackRepo),
		AdminDeleteFeedbackUC:  feedbackUC.NewAdminDeleteFeedbackUseCase(feedbackRepo),

		RegisterDeviceUC: deviceUC.NewRegisterDeviceUseCase(deviceRepo),
		ListDevicesUC:    deviceUC.NewListDevicesUseCase(deviceRepo),

		CreateTodoUC:            todosUC.NewCreateTodoUseCase(todoRepo, organizationRepo, userRepo, todoOneSignal),
		ListTodosUC:             todosUC.NewListTodosUseCase(todoRepo, userRepo),
		UpdateTodoUC:            todosUC.NewUpdateTodoUseCase(todoRepo, organizationRepo, userRepo, todoOneSignal),
		DeleteTodoUC:            todosUC.NewDeleteTodoUseCase(todoRepo, userRepo, todoOneSignal),
		ListUserTodoSubtasksUC:  todosUC.NewListUserTodoSubtasksUseCase(todoRepo),
		CreateUserTodoSubtaskUC: todosUC.NewCreateUserTodoSubtaskUseCase(todoRepo),
		UpdateUserTodoSubtaskUC: todosUC.NewUpdateUserTodoSubtaskUseCase(todoRepo),
		DeleteUserTodoSubtaskUC: todosUC.NewDeleteUserTodoSubtaskUseCase(todoRepo),

		CreateOrganizationUC:             organizationUC.NewCreateOrganizationUseCase(organizationRepo),
		InviteToOrganizationUC:           organizationUC.NewInviteToOrganizationUseCase(organizationRepo),
		AcceptInvitationUC:               organizationUC.NewAcceptInvitationUseCase(organizationRepo),
		DeclineInvitationUC:              organizationUC.NewDeclineInvitationUseCase(organizationRepo),
		RevokeOrganizationInvitationUC:   organizationUC.NewRevokeOrganizationInvitationUseCase(organizationRepo),
		ResendOrganizationInvitationUC:   organizationUC.NewResendOrganizationInvitationUseCase(organizationRepo),
		ListOrganizationsUC:              organizationUC.NewListOrganizationsUseCase(organizationRepo),
		ListOrganizationMembersUC:        organizationUC.NewListOrganizationMembersUseCase(organizationRepo, getProfileUC),
		ListOrganizationInvitationsUC:    organizationUC.NewListOrganizationInvitationsUseCase(organizationRepo),
		ListPendingInvitationsUC:         organizationUC.NewListPendingInvitationsUseCase(organizationRepo),
		GetOrganizationUC:                organizationUC.NewGetOrganizationUseCase(organizationRepo),
		UpdateOrganizationUC:             organizationUC.NewUpdateOrganizationUseCase(organizationRepo),
		RemoveOrganizationMemberUC:       organizationUC.NewRemoveOrganizationMemberUseCase(organizationRepo),
		LeaveOrganizationUC:              organizationUC.NewLeaveOrganizationUseCase(organizationRepo),
		SetOrganizationMemberSuspendedUC: organizationUC.NewSetOrganizationMemberSuspendedUseCase(organizationRepo),
		ListOrganizationNewsUC:           organizationUC.NewListOrganizationNewsUseCase(organizationRepo, getProfileUC),
		CreateOrganizationNewsUC:         organizationUC.NewCreateOrganizationNewsUseCase(organizationRepo, getProfileUC),
		UpdateOrganizationNewsUC:         organizationUC.NewUpdateOrganizationNewsUseCase(organizationRepo, getProfileUC),
		DeleteOrganizationNewsUC:         organizationUC.NewDeleteOrganizationNewsUseCase(organizationRepo),
		ListOrganizationMessagesUC:       organizationUC.NewListOrganizationMessagesUseCase(organizationRepo, getProfileUC),
		PostOrganizationMessageUC:        organizationUC.NewPostOrganizationMessageUseCase(organizationRepo, getProfileUC),
		DeleteOrganizationMessageUC:      organizationUC.NewDeleteOrganizationMessageUseCase(organizationRepo),
		OrganizationMessageBroadcaster:   orgMessageBroadcaster,

		ListOrganizationProjectsUC:                 organizationUC.NewListOrganizationProjectsUseCase(organizationRepo),
		GetOrganizationProjectUC:                   organizationUC.NewGetOrganizationProjectUseCase(organizationRepo),
		ListOrganizationProjectMembersUC:           organizationUC.NewListOrganizationProjectMembersUseCase(organizationRepo, getProfileUC),
		ListOrganizationProjectTodosUC:             organizationUC.NewListOrganizationProjectTodosUseCase(organizationRepo),
		CreateOrganizationProjectUC:                organizationUC.NewCreateOrganizationProjectUseCase(organizationRepo),
		UpdateOrganizationProjectUC:                organizationUC.NewUpdateOrganizationProjectUseCase(organizationRepo),
		DeleteOrganizationProjectUC:                organizationUC.NewDeleteOrganizationProjectUseCase(organizationRepo),
		AddOrganizationProjectMemberUC:             organizationUC.NewAddOrganizationProjectMemberUseCase(organizationRepo),
		RemoveOrganizationProjectMemberUC:          organizationUC.NewRemoveOrganizationProjectMemberUseCase(organizationRepo),
		CreateOrganizationProjectTodoUC:            organizationUC.NewCreateOrganizationProjectTodoUseCase(organizationRepo, todoOneSignal),
		UpdateOrganizationProjectTodoUC:            organizationUC.NewUpdateOrganizationProjectTodoUseCase(organizationRepo, todoOneSignal),
		DeleteOrganizationProjectTodoUC:            organizationUC.NewDeleteOrganizationProjectTodoUseCase(organizationRepo, todoOneSignal),
		ListOrganizationProjectTodoSubtasksUC:      organizationUC.NewListOrganizationProjectTodoSubtasksUseCase(organizationRepo),
		CreateOrganizationProjectTodoSubtaskUC:     organizationUC.NewCreateOrganizationProjectTodoSubtaskUseCase(organizationRepo),
		UpdateOrganizationProjectTodoSubtaskUC:     organizationUC.NewUpdateOrganizationProjectTodoSubtaskUseCase(organizationRepo),
		DeleteOrganizationProjectTodoSubtaskUC:     organizationUC.NewDeleteOrganizationProjectTodoSubtaskUseCase(organizationRepo),
		ListOrganizationProjectPurchasesUC:         organizationUC.NewListOrganizationProjectPurchasesUseCase(organizationRepo),
		CreateOrganizationProjectPurchaseUC:        organizationUC.NewCreateOrganizationProjectPurchaseUseCase(organizationRepo),
		UpdateOrganizationProjectPurchaseUC:        organizationUC.NewUpdateOrganizationProjectPurchaseUseCase(organizationRepo),
		DeleteOrganizationProjectPurchaseUC:        organizationUC.NewDeleteOrganizationProjectPurchaseUseCase(organizationRepo),
		CreateOrganizationProjectOrgInviteUC:       organizationUC.NewCreateOrganizationProjectOrgInviteUseCase(organizationRepo, projectOrgInvitePush),
		AcceptOrganizationProjectOrgInviteUC:       organizationUC.NewAcceptOrganizationProjectOrgInviteUseCase(organizationRepo),
		ListPendingOrganizationProjectOrgInvitesUC: organizationUC.NewListPendingOrganizationProjectOrgInvitesUseCase(organizationRepo),
		OwnerTodoDashboardUC:                       organizationUC.NewOwnerTodoDashboardUseCase(organizationRepo),

		ListNotificationsUC:          notificationUC.NewListNotificationsUseCase(notificationRepo),
		MarkNotificationReadUC:       notificationUC.NewMarkNotificationReadUseCase(notificationRepo),
		MarkAllNotificationsReadUC:   notificationUC.NewMarkAllNotificationsReadUseCase(notificationRepo),
		AdminCreateNotificationUC:    notificationUC.NewAdminCreateNotificationUseCase(notificationRepo, eventBus),
		AdminClearAllNotificationsUC: notificationUC.NewAdminClearAllNotificationsUseCase(notificationRepo),
		AdminDeleteNotificationUC:    notificationUC.NewAdminDeleteNotificationUseCase(notificationRepo),
		AdminUpdateNotificationUC:    notificationUC.NewAdminUpdateNotificationUseCase(notificationRepo),

		ListUsersUC:             adminUC.NewListUsersUseCase(userRepo),
		GetUserByIDUC:           adminUC.NewGetUserByIDUseCase(userRepo),
		SuspendUserUC:           adminUC.NewSuspendUserUseCase(userRepo, adminRevokeCoord),
		ChangeRoleUC:            adminUC.NewChangeUserRoleUseCase(userRepo, adminRevokeCoord),
		SetUserStatusUC:         adminUC.NewSetUserStatusUseCase(userRepo, adminRevokeCoord),
		DeleteUserUC:            adminUC.NewDeleteUserUseCase(userRepo, eventBus),
		GetUserDeletionImpactUC: adminUC.NewGetUserDeletionImpactUseCase(userRepo, userDeletionImpactRepo),
		ListUserSessionsUC:      adminUC.NewListUserSessionsUseCase(sessionRepo),
		GetSessionStatsUC:       adminUC.NewGetSessionStatsUseCase(sessionRepo),

		AdminListUserOwnedTodosUC: adminUC.NewAdminListUserOwnedTodosUseCase(todoRepo),
		AdminDeleteUserTodoUC:     adminUC.NewAdminDeleteUserTodoUseCase(todoRepo),
		AdminUpdateUserTodoUC:     adminUC.NewAdminUpdateUserTodoUseCase(todoRepo),

		ListUserMessagesUC:       usermessageUC.NewListUserMessagesUseCase(userMessageRepo),
		AdminCreateUserMessageUC: adminCreateUserMsgUC,
		MarkUserMessageReadUC:    usermessageUC.NewMarkUserMessageReadUseCase(userMessageRepo),
		AdminDeleteUserMessageUC: usermessageUC.NewAdminDeleteUserMessageUseCase(userMessageRepo),
		UserMessageBroadcaster:   userMessageBroadcaster,
		// OTP
		RequestOTPUC:           requestOTPUC,
		VerifyOTPUC:            verifyOTPUC,
		AdminListPendingOTPsUC: otpUC.NewAdminListPendingOTPsUseCase(otpRepo),
		AdminUserOTPHistoryUC:  otpUC.NewAdminUserOTPHistoryUseCase(otpRepo),

		GetAdminMailSMTPSettingsUC:    mailUC.NewGetAdminMailSMTPSettingsUseCase(mailSMTPRepo),
		UpdateAdminMailSMTPSettingsUC: mailUC.NewUpdateAdminMailSMTPSettingsUseCase(mailSMTPRepo, effectiveSMTPResolver, cfg),
		AdminSendTestMailUC:           mailUC.NewAdminSendTestMailUseCase(effectiveSMTPResolver, cacheHandler, cfg),
		AdminSendUserEmailUC:          mailUC.NewAdminSendUserEmailUseCase(effectiveSMTPResolver, userRepo),
	}

	// ── GraphQL server ──────────────────────────────────────────────────────
	// Build the server manually so we can conditionally enable introspection.
	gqlSrv := handler.New(generated.NewExecutableSchema(generated.Config{Resolvers: res}))
	gqlSrv.AddTransport(transport.Websocket{
		KeepAlivePingInterval: 10 * time.Second,
		InitFunc:              websocketInitWithAuth(jwtSvc),
	})
	gqlSrv.AddTransport(transport.Options{})
	gqlSrv.AddTransport(transport.GET{})
	gqlSrv.AddTransport(transport.POST{})
	gqlSrv.AddTransport(transport.MultipartForm{})
	gqlSrv.SetQueryCache(lru.New[*ast.QueryDocument](1000))
	if cfg.GraphQL.Introspection {
		gqlSrv.Use(extension.Introspection{})
	} else {
		log.Info("GraphQL introspection disabled")
	}
	gqlSrv.Use(extension.AutomaticPersistedQuery{Cache: lru.New[string](100)})

	// Query complexity limit (DoS protection)
	if cfg.GraphQL.ComplexityLimit > 0 {
		gqlSrv.Use(extension.FixedComplexityLimit(cfg.GraphQL.ComplexityLimit))
		log.Info("GraphQL complexity limit", slog.Int("limit", cfg.GraphQL.ComplexityLimit))
	}
	if cfg.GraphQL.QueryDepthLimit > 0 {
		gqlSrv.Use(graphqldepth.FixedLimit(cfg.GraphQL.QueryDepthLimit))
		log.Info("GraphQL query depth limit", slog.Int("limit", cfg.GraphQL.QueryDepthLimit))
	}

	// Error presenter: expose domain error codes, hide internal details.
	gqlSrv.SetErrorPresenter(func(ctx context.Context, err error) *gqlerror.Error {
		gqlErr := graphql.DefaultErrorPresenter(ctx, err)

		// Unwrap through gqlgen/fmt wrappers to find our DomainError
		var de *domainErr.DomainError
		if errors.As(err, &de) {
			gqlErr.Message = de.Message
			if gqlErr.Extensions == nil {
				gqlErr.Extensions = map[string]interface{}{}
			}
			gqlErr.Extensions["code"] = de.Code
			return gqlErr
		}

		// Parser/validator/limits already attach extensions.code (e.g. GRAPHQL_VALIDATION_FAILED).
		// Do not replace their message with a generic INTERNAL_ERROR — that hides schema skew
		// (e.g. client requests assignedToUserId while the server binary is older).
		if gqlErr.Extensions != nil {
			if code, _ := gqlErr.Extensions["code"].(string); code != "" && code != "INTERNAL_ERROR" {
				return gqlErr
			}
		}

		// Strip internal details from non-domain errors
		log.Error("unhandled graphql error", slog.Any("error", err))
		gqlErr.Message = "an internal error occurred"
		if gqlErr.Extensions == nil {
			gqlErr.Extensions = map[string]interface{}{}
		}
		gqlErr.Extensions["code"] = "INTERNAL_ERROR"
		return gqlErr
	})

	// ── HTTP router ─────────────────────────────────────────────────────────
	router := chi.NewRouter()
	router.Use(chiMiddleware.RequestID)
	router.Use(chiMiddleware.RealIP)
	router.Use(chiMiddleware.Recoverer)
	router.Use(middleware.SecurityHeaders(middleware.SecurityHeadersConfig{DisableHSTS: cfg.Server.DisableHSTS}))
	router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORS.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID"},
		ExposedHeaders:   []string{"X-Request-ID"},
		AllowCredentials: false,
		MaxAge:           300,
	}))
	if cfg.Server.HTTPRateLimitPerMinute > 0 {
		router.Use(httprate.LimitByIP(cfg.Server.HTTPRateLimitPerMinute, 1*time.Minute))
		log.Info("http rate limit enabled", slog.Int("per_minute", cfg.Server.HTTPRateLimitPerMinute))
	} else {
		log.Info("http rate limit disabled (set HTTP_RATE_LIMIT_PER_MIN to enable)")
	}

	router.Use(middleware.RequestIDMiddleware)
	router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/graphql" {
				isWebSocket := strings.EqualFold(r.Header.Get("Upgrade"), "websocket")
				log.Debug(
					"graphql endpoint request",
					slog.String("method", r.Method),
					slog.String("path", r.URL.Path),
					slog.Bool("websocket", isWebSocket),
					slog.String("remote_addr", r.RemoteAddr),
				)
			}
			next.ServeHTTP(w, r)
		})
	})
	router.Use(middleware.AuthMiddleware(jwtSvc))

	// GraphQL endpoint (body size capped at 2 MB)
	const maxBodyBytes = 2 << 20 // 2 MB
	router.With(middleware.MaxBodySize(maxBodyBytes)).With(httpctx.Middleware).Handle("/graphql", gqlSrv)

	// Playground (gated by GRAPHQL_PLAYGROUND; disabled by default in production)
	if cfg.GraphQL.Playground {
		router.Handle("/", playground.Handler("MasterFabric GraphQL", "/graphql"))
		log.Info("GraphQL playground enabled on /")
	} else {
		router.Get("/", func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintf(w, `{"status":"ok","service":"%s","version":"%s"}`, version.ServiceName, version.Version)
		})
		log.Info("GraphQL playground disabled")
	}

	// Health checks
	// GET /health        — liveness  (always 200 if process is up)
	// GET /health/ready  — readiness (503 if postgres or redis fail after probe retries)
	router.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","service":"%s","version":"%s"}`, version.ServiceName, version.Version)
	})
	router.Get("/health/ready", health.Handler(pool, redisClient))

	// ── HTTP server ─────────────────────────────────────────────────────────
	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      router,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
		IdleTimeout:  cfg.Server.IdleTimeout,
	}

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Info("server listening", slog.String("addr", addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("server error", slog.Any("error", err))
			os.Exit(1)
		}
	}()

	<-quit
	log.Info("shutting down server...")

	shutCtx, shutCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutCancel()
	if err := srv.Shutdown(shutCtx); err != nil {
		log.Error("graceful shutdown failed", slog.Any("error", err))
	}
	log.Info("server stopped")
}
