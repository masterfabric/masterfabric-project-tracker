/**
 * mf-go GraphQL API — typed service for Auth, User, Settings, Admin.
 * Uses graphql-client (EXPO_PUBLIC_GRAPHQL_URL).
 */

import {
  graphqlRequest,
  setGraphQLAuthToken,
  clearGraphQLAuthToken,
} from './graphql-client';
import { isDueAtSchemaMismatchError, isSubtasksSchemaMismatchError } from './graphql-due-at-fallback';
import { logger } from './logger';

// ── Types (match mf-go schema) ───────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'MODERATOR' | 'USER';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type Theme = 'LIGHT' | 'DARK' | 'SYSTEM';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarURL: string;
  role: UserRole;
}

export interface AuthPayload {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface LoginPayload {
  otpRequired: boolean;
  loginToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user: AuthUser;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  nickname: string;
  avatarURL: string;
  bio: string;
  status: UserStatus;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  phoneNumber: string;
  dateOfBirth: string | null;
  gender: string;
  location: string;
  websiteURL: string;
  socialTwitter: string;
  socialGitHub: string;
  socialLinkedIn: string;
  language: string;
  telegramChatId: string;
  address?: UserAddress | null;
  /** Present when the `me` / `updateProfile` query requests `addresses` (mf-go UserProfile.addresses). */
  addresses?: UserAddress[];
}

export interface UserAddress {
  id: string;
  userID: string;
  title: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** GraphQL UpsertAddressInput — omit addressID to create. */
export interface UpsertAddressInput {
  addressID?: string;
  title?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
}

export interface MyOwnedOrganizationDeletionImpact {
  organizationID: string;
  name: string;
  otherMemberCount: number;
}

/** `myAccountDeletionImpact` — matches PostgreSQL CASCADE / SET NULL when deleting the user. */
export interface MyAccountDeletionImpact {
  ownedTodoCount: number;
  todoAssigneeClearCount: number;
  organizationMembershipCount: number;
  ownedOrganizations: MyOwnedOrganizationDeletionImpact[];
  addressCount: number;
  deviceCount: number;
  hasUserSettings: boolean;
  notificationReadCount: number;
  sessionCount: number;
  userMessageCount: number;
  pendingInvitationAsInviterCount: number;
  organizationMessageAuthoredCount: number;
  organizationNewsAuthoredCount: number;
  otpCodeHistoryCount: number;
}

export interface UserSettingsPayload {
  id: string;
  userID: string;
  notificationsOn: boolean;
  otpEnabled: boolean;
  theme: Theme;
  language: string;
  timezone: string;
  updatedAt: string;
}

export interface AppSetting {
  key: string;
  value: string;
  description: string;
}

export interface AdminUserProfile {
  id: string;
  email: string;
  displayName: string;
  nickname: string;
  avatarURL: string;
  bio: string;
  status: UserStatus;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  phoneNumber: string;
  dateOfBirth: string | null;
  gender: string;
  location: string;
  websiteURL: string;
  socialTwitter: string;
  socialGitHub: string;
  socialLinkedIn: string;
  language: string;
  telegramChatId: string;
}

export interface AdminUserList {
  users: AdminUserProfile[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** GraphQL: AdminOwnedOrganizationDeletionImpact */
export interface AdminOwnedOrganizationDeletionImpact {
  organizationID: string;
  name: string;
  otherMemberCount: number;
}

/** GraphQL: AdminUserDeletionImpact — preview of DB cascade when admin deletes a user */
export interface AdminUserDeletionImpact {
  userID: string;
  email: string;
  displayName: string;
  ownedTodoCount: number;
  todoAssigneeClearCount: number;
  organizationMembershipCount: number;
  ownedOrganizations: AdminOwnedOrganizationDeletionImpact[];
  addressCount: number;
  deviceCount: number;
  hasUserSettings: boolean;
  notificationReadCount: number;
  sessionCount: number;
  userMessageCount: number;
  pendingInvitationAsInviterCount: number;
}

export interface AdminAppSetting {
  key: string;
  value: string;
  description: string;
  isPublic: boolean;
}

/** Admin singleton SMTP row (password never returned). */
export interface AdminMailSmtpSettings {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  passwordConfigured: boolean;
  fromAddress: string;
  fromName: string;
  subjectPrefix: string;
  implicitTLS: boolean;
  plainNoTLS: boolean;
  updatedAt: string;
}

export interface AdminUpdateMailSmtpSettingsInput {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  /** Omit to keep existing; empty string clears stored password. */
  password?: string | null;
  fromAddress: string;
  fromName: string;
  subjectPrefix: string;
  implicitTLS: boolean;
  plainNoTLS: boolean;
}

/** GraphQL: ProductRelease — admin-published version + Markdown changelog (public query). */
export interface ProductRelease {
  version: string;
  changelogMarkdown: string;
  updatedAt: string;
  updatedByDisplayName?: string | null;
}

export interface UserSession {
  id: string;
  userID: string;
  userEmail: string;
  userDisplayName: string;
  organizationNames: string[];
  deviceID: string;
  platform: string;
  deviceName: string;
  createdAt: string;
  lastRefreshedAt: string;
}

export interface AdminSessionStats {
  totalActiveSessions: number;
  uniqueActiveUsers: number;
  totalUsers: number;
  totalRegisteredDevices: number;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

const REGISTER = /* GraphQL */ `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
      refreshToken
      expiresIn
      user { id email displayName avatarURL role }
    }
  }
`;

const LOGIN = /* GraphQL */ `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      otpRequired
      loginToken
      accessToken
      refreshToken
      expiresIn
      user { id email displayName avatarURL role }
    }
  }
`;

const REFRESH_TOKENS = /* GraphQL */ `
  mutation RefreshTokens($input: RefreshInput!) {
    refreshTokens(input: $input) {
      accessToken
      refreshToken
      expiresIn
      user { id email displayName avatarURL role }
    }
  }
`;

const LOGOUT = /* GraphQL */ `
  mutation Logout($input: LogoutInput!) {
    logout(input: $input)
  }
`;

const REQUEST_PASSWORD_RESET = /* GraphQL */ `
  mutation RequestPasswordReset($input: RequestPasswordResetInput!) {
    requestPasswordReset(input: $input) {
      ok
    }
  }
`;

const RESET_PASSWORD_WITH_OTP = /* GraphQL */ `
  mutation ResetPasswordWithOtp($input: ResetPasswordWithOtpInput!) {
    resetPasswordWithOtp(input: $input)
  }
`;

export const mfGoAuth = {
  register: (email: string, password: string, displayName: string) =>
    graphqlRequest<{ register: AuthPayload }>(REGISTER, {
      input: { email, password, displayName },
    }).then((r) => r.register),

  login: (email: string, password: string) =>
    graphqlRequest<{ login: LoginPayload }>(LOGIN, {
      input: { email, password },
    }).then((r) => r.login),

  loginVerifyOTP: (loginToken: string, code: string) =>
    graphqlRequest<{ loginVerifyOTP: AuthPayload }>(
      /* GraphQL */ `
        mutation LoginVerifyOTP($input: LoginVerifyOTPInput!) {
          loginVerifyOTP(input: $input) {
            accessToken refreshToken expiresIn
            user { id email displayName avatarURL role }
          }
        }
      `,
      { input: { loginToken, code } }
    ).then((r) => r.loginVerifyOTP),

  refreshTokens: (
    userID: string,
    refreshToken: string,
    deviceInfo?: { deviceId?: string; platform?: string; deviceName?: string } | null
  ) => {
    const input: Record<string, unknown> = { userID, refreshToken };
    if (deviceInfo != null) {
      if (deviceInfo.deviceId != null) input.deviceID = deviceInfo.deviceId;
      if (deviceInfo.platform != null) input.platform = deviceInfo.platform;
      if (deviceInfo.deviceName != null) input.deviceName = deviceInfo.deviceName;
    }
    return graphqlRequest<{ refreshTokens: AuthPayload }>(
      REFRESH_TOKENS,
      { input },
      { skipAuthRecovery: true }
    ).then((r) => r.refreshTokens);
  },

  logout: (userID: string, accessToken: string, refreshToken: string) =>
    graphqlRequest<{ logout: boolean }>(LOGOUT, {
      input: { userID, accessToken, refreshToken },
    }).then((r) => r.logout),

  requestPasswordReset: (email: string) =>
    graphqlRequest<{ requestPasswordReset: { ok: boolean } }>(REQUEST_PASSWORD_RESET, {
      input: { email },
    }).then((r) => r.requestPasswordReset),

  resetPasswordWithOtp: (email: string, code: string, newPassword: string) =>
    graphqlRequest<{ resetPasswordWithOtp: boolean }>(RESET_PASSWORD_WITH_OTP, {
      input: { email, code, newPassword },
    }).then((r) => r.resetPasswordWithOtp),
};

// ── User ─────────────────────────────────────────────────────────────────────

const USER_ADDRESS_FIELDS = /* GraphQL */ `
  id userID title addressLine1 addressLine2 city state postalCode country isDefault createdAt updatedAt
`;

const ME = /* GraphQL */ `
  query Me {
    me {
      id email displayName nickname avatarURL bio status role createdAt updatedAt
      phoneNumber telegramChatId dateOfBirth gender location websiteURL
      socialTwitter socialGitHub socialLinkedIn language
      address { id title addressLine1 addressLine2 city state postalCode country isDefault createdAt updatedAt }
      addresses { ${USER_ADDRESS_FIELDS} }
    }
  }
`;

/** Fallback for backends that don't yet have nickname in schema */
const ME_WITHOUT_NICKNAME = /* GraphQL */ `
  query Me {
    me {
      id email displayName avatarURL bio status role createdAt updatedAt
      phoneNumber telegramChatId dateOfBirth gender location websiteURL
      socialTwitter socialGitHub socialLinkedIn language
      address { id title addressLine1 addressLine2 city state postalCode country isDefault createdAt updatedAt }
      addresses { ${USER_ADDRESS_FIELDS} }
    }
  }
`;

const UPDATE_PROFILE = /* GraphQL */ `
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id email displayName nickname avatarURL bio status role createdAt updatedAt
      phoneNumber telegramChatId dateOfBirth gender location websiteURL
      socialTwitter socialGitHub socialLinkedIn language
      address { id title addressLine1 addressLine2 city state postalCode country isDefault createdAt updatedAt }
      addresses { ${USER_ADDRESS_FIELDS} }
    }
  }
`;

/** Fallback for backends without nickname in schema */
const UPDATE_PROFILE_WITHOUT_NICKNAME = /* GraphQL */ `
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id email displayName avatarURL bio status role createdAt updatedAt
      phoneNumber telegramChatId dateOfBirth gender location websiteURL
      socialTwitter socialGitHub socialLinkedIn language
      address { id title addressLine1 addressLine2 city state postalCode country isDefault createdAt updatedAt }
      addresses { ${USER_ADDRESS_FIELDS} }
    }
  }
`;

/** Backends without `UserProfile.addresses` (same shape as ME minus `addresses`). */
const ME_LEGACY_NO_ADDRESSES = /* GraphQL */ `
  query Me {
    me {
      id email displayName nickname avatarURL bio status role createdAt updatedAt
      phoneNumber telegramChatId dateOfBirth gender location websiteURL
      socialTwitter socialGitHub socialLinkedIn language
      address { id title addressLine1 addressLine2 city state postalCode country isDefault createdAt updatedAt }
    }
  }
`;

const ME_WITHOUT_NICKNAME_LEGACY_NO_ADDRESSES = /* GraphQL */ `
  query Me {
    me {
      id email displayName avatarURL bio status role createdAt updatedAt
      phoneNumber telegramChatId dateOfBirth gender location websiteURL
      socialTwitter socialGitHub socialLinkedIn language
      address { id title addressLine1 addressLine2 city state postalCode country isDefault createdAt updatedAt }
    }
  }
`;

const UPDATE_PROFILE_LEGACY_NO_ADDRESSES = /* GraphQL */ `
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id email displayName nickname avatarURL bio status role createdAt updatedAt
      phoneNumber telegramChatId dateOfBirth gender location websiteURL
      socialTwitter socialGitHub socialLinkedIn language
      address { id title addressLine1 addressLine2 city state postalCode country isDefault createdAt updatedAt }
    }
  }
`;

const UPDATE_PROFILE_WITHOUT_NICKNAME_LEGACY_NO_ADDRESSES = /* GraphQL */ `
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id email displayName avatarURL bio status role createdAt updatedAt
      phoneNumber telegramChatId dateOfBirth gender location websiteURL
      socialTwitter socialGitHub socialLinkedIn language
      address { id title addressLine1 addressLine2 city state postalCode country isDefault createdAt updatedAt }
    }
  }
`;

const NICKNAME_AVAILABLE = /* GraphQL */ `
  query NicknameAvailable($nickname: String!) {
    nicknameAvailable(nickname: $nickname)
  }
`;

const DELETE_ACCOUNT = /* GraphQL */ `
  mutation DeleteAccount {
    deleteAccount
  }
`;

const MY_ACCOUNT_DELETION_IMPACT = /* GraphQL */ `
  query MyAccountDeletionImpact {
    myAccountDeletionImpact {
      ownedTodoCount
      todoAssigneeClearCount
      organizationMembershipCount
      ownedOrganizations {
        organizationID
        name
        otherMemberCount
      }
      addressCount
      deviceCount
      hasUserSettings
      notificationReadCount
      sessionCount
      userMessageCount
      pendingInvitationAsInviterCount
      organizationMessageAuthoredCount
      organizationNewsAuthoredCount
      otpCodeHistoryCount
    }
  }
`;

const MY_ADDRESSES = /* GraphQL */ `
  query MyAddresses {
    myAddresses { ${USER_ADDRESS_FIELDS} }
  }
`;

const UPSERT_ADDRESS = /* GraphQL */ `
  mutation UpsertAddress($input: UpsertAddressInput!) {
    upsertAddress(input: $input) { ${USER_ADDRESS_FIELDS} }
  }
`;

const DELETE_MY_ADDRESS = /* GraphQL */ `
  mutation DeleteMyAddress($id: UUID!) {
    deleteMyAddress(id: $id)
  }
`;

function isAddressesFieldError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    (msg.includes('addresses') && msg.includes('UserProfile')) ||
    msg.includes('Cannot query field "addresses"')
  );
}

function isNicknameSchemaError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('nickname') && msg.includes('UserProfile');
}

/** Backend rejects nickname in UpdateProfileInput (old schema) */
function isNicknameInputError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('unknown field') && msg.includes('nickname')) return true;
  const err = error as { response?: { errors?: { path?: unknown[] }[] } };
  const path = err.response?.errors?.[0]?.path;
  return Array.isArray(path) && path.includes('nickname');
}

async function withAddressesIfMissing(profile: UserProfile): Promise<UserProfile> {
  if (profile.addresses != null) return profile;
  try {
    const r = await graphqlRequest<{ myAddresses: UserAddress[] }>(MY_ADDRESSES);
    return { ...profile, addresses: r.myAddresses };
  } catch {
    return { ...profile, addresses: [] };
  }
}

function upsertAddressInputToGraphQL(input: UpsertAddressInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.addressID !== undefined) out.addressID = input.addressID;
  if (input.title !== undefined) out.title = input.title;
  if (input.addressLine1 !== undefined) out.addressLine1 = input.addressLine1;
  if (input.addressLine2 !== undefined) out.addressLine2 = input.addressLine2;
  if (input.city !== undefined) out.city = input.city;
  if (input.state !== undefined) out.state = input.state;
  if (input.postalCode !== undefined) out.postalCode = input.postalCode;
  if (input.country !== undefined) out.country = input.country;
  if (input.isDefault !== undefined) out.isDefault = input.isDefault;
  return out;
}

export const mfGoUser = {
  nicknameAvailable: (nickname: string) =>
    graphqlRequest<{ nicknameAvailable: boolean }>(
      NICKNAME_AVAILABLE,
      { nickname: nickname.trim() },
      { silent: true }
    ).then((r) => r.nicknameAvailable),

  me: async (): Promise<UserProfile> => {
    try {
      const r = await graphqlRequest<{ me: UserProfile }>(ME, undefined, { silent: true });
      return withAddressesIfMissing(r.me);
    } catch (error) {
      if (isAddressesFieldError(error)) {
        try {
          const r = await graphqlRequest<{ me: UserProfile }>(ME_LEGACY_NO_ADDRESSES, undefined, {
            silent: true,
          });
          return withAddressesIfMissing(r.me);
        } catch (e2) {
          if (isNicknameSchemaError(e2)) {
            const r = await graphqlRequest<{ me: Omit<UserProfile, 'nickname'> }>(
              ME_WITHOUT_NICKNAME_LEGACY_NO_ADDRESSES
            );
            return withAddressesIfMissing({ ...r.me, nickname: '' });
          }
          logger.error('GraphQL request failed', { error: e2 });
          throw e2;
        }
      }
      if (isNicknameSchemaError(error)) {
        const r = await graphqlRequest<{ me: Omit<UserProfile, 'nickname'> }>(ME_WITHOUT_NICKNAME);
        return withAddressesIfMissing({ ...r.me, nickname: '' });
      }
      logger.error('GraphQL request failed', { error });
      throw error;
    }
  },

  updateProfile: async (input: Record<string, unknown>): Promise<UserProfile> => {
    const inputWithoutNickname = () => {
      const { nickname: _, ...rest } = input;
      return rest;
    };
    const run = async (
      mutation: string,
      vars: { input: Record<string, unknown> }
    ): Promise<UserProfile> => {
      const r = await graphqlRequest<{ updateProfile: UserProfile }>(mutation, vars, {
        silent: true,
      });
      return withAddressesIfMissing(r.updateProfile);
    };
    try {
      return await run(UPDATE_PROFILE, { input });
    } catch (error) {
      if (isAddressesFieldError(error)) {
        try {
          return await run(UPDATE_PROFILE_LEGACY_NO_ADDRESSES, { input });
        } catch (e2) {
          if (isNicknameSchemaError(e2) || isNicknameInputError(e2)) {
            const r = await graphqlRequest<{ updateProfile: Omit<UserProfile, 'nickname'> }>(
              UPDATE_PROFILE_WITHOUT_NICKNAME_LEGACY_NO_ADDRESSES,
              { input: inputWithoutNickname() }
            );
            return withAddressesIfMissing({ ...r.updateProfile, nickname: '' });
          }
          logger.error('GraphQL request failed', { error: e2 });
          throw e2;
        }
      }
      if (isNicknameSchemaError(error) || isNicknameInputError(error)) {
        try {
          return await run(UPDATE_PROFILE_WITHOUT_NICKNAME, { input: inputWithoutNickname() });
        } catch (e2) {
          if (isAddressesFieldError(e2)) {
            const r = await graphqlRequest<{ updateProfile: Omit<UserProfile, 'nickname'> }>(
              UPDATE_PROFILE_WITHOUT_NICKNAME_LEGACY_NO_ADDRESSES,
              { input: inputWithoutNickname() }
            );
            return withAddressesIfMissing({ ...r.updateProfile, nickname: '' });
          }
          throw e2;
        }
      }
      logger.error('GraphQL request failed', { error });
      throw error;
    }
  },

  myAddresses: () =>
    graphqlRequest<{ myAddresses: UserAddress[] }>(MY_ADDRESSES).then((r) => r.myAddresses),

  upsertAddress: (input: UpsertAddressInput) =>
    graphqlRequest<{ upsertAddress: UserAddress }>(UPSERT_ADDRESS, {
      input: upsertAddressInputToGraphQL(input),
    }).then((r) => r.upsertAddress),

  deleteMyAddress: (id: string) =>
    graphqlRequest<{ deleteMyAddress: boolean }>(DELETE_MY_ADDRESS, { id }).then(
      (r) => r.deleteMyAddress
    ),

  deleteAccount: () =>
    graphqlRequest<{ deleteAccount: boolean }>(DELETE_ACCOUNT).then(
      (r) => r.deleteAccount
    ),

  myAccountDeletionImpact: () =>
    graphqlRequest<{ myAccountDeletionImpact: MyAccountDeletionImpact }>(
      MY_ACCOUNT_DELETION_IMPACT,
      undefined,
      { silent: true }
    ).then((r) => r.myAccountDeletionImpact),
};

// ── Settings ───────────────────────────────────────────────────────────────

const MY_SETTINGS = /* GraphQL */ `
  query MySettings {
    mySettings {
      id userID notificationsOn otpEnabled theme language timezone updatedAt
    }
  }
`;

const APP_SETTINGS = /* GraphQL */ `
  query AppSettings {
    appSettings { key value description }
  }
`;

const PRODUCT_RELEASE = /* GraphQL */ `
  query ProductRelease {
    productRelease {
      version
      changelogMarkdown
      updatedAt
      updatedByDisplayName
    }
  }
`;

const UPDATE_MY_SETTINGS = /* GraphQL */ `
  mutation UpdateMySettings($input: UserSettingsInput!) {
    updateMySettings(input: $input) {
      id userID notificationsOn otpEnabled theme language timezone updatedAt
    }
  }
`;

export const mfGoSettings = {
  mySettings: () =>
    graphqlRequest<{ mySettings: UserSettingsPayload }>(MY_SETTINGS).then(
      (r) => r.mySettings
    ),

  appSettings: () =>
    graphqlRequest<{ appSettings: AppSetting[] }>(APP_SETTINGS).then(
      (r) => r.appSettings
    ),

  productRelease: () =>
    graphqlRequest<{ productRelease: ProductRelease }>(PRODUCT_RELEASE, undefined, {
      silent: true,
    }).then((r) => r.productRelease),

  updateMySettings: (input: {
    notificationsOn?: boolean;
    theme?: Theme;
    language?: string;
    timezone?: string;
    otpEnabled?: boolean;
  }) =>
    graphqlRequest<{ updateMySettings: UserSettingsPayload }>(
      UPDATE_MY_SETTINGS,
      { input }
    ).then((r) => r.updateMySettings),
};

// ── Device ────────────────────────────────────────────────────────────────────

export interface UserDevicePayload {
  id: string;
  userID: string;
  deviceId: string;
  platform: string;
  deviceName: string;
  model: string;
  brand: string;
  osName: string;
  osVersion: string;
  appName: string;
  appVersion: string;
  appBuild: string;
  createdAt: string;
  updatedAt: string;
}

const REGISTER_DEVICE = /* GraphQL */ `
  mutation RegisterDevice($input: RegisterDeviceInput!) {
    registerDevice(input: $input) {
      id userID deviceId platform deviceName model brand
      osName osVersion appName appVersion appBuild
      createdAt updatedAt
    }
  }
`;

const MY_DEVICES = /* GraphQL */ `
  query MyDevices {
    myDevices {
      id userID deviceId platform deviceName model brand
      osName osVersion appName appVersion appBuild
      createdAt updatedAt
    }
  }
`;

// ── Organizations ────────────────────────────────────────────────────────────

export type OrganizationMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type OrganizationMembershipStatus = 'ACTIVE' | 'SUSPENDED';
export type OrganizationInvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export interface OrganizationPayload {
  id: string;
  name: string;
  description: string;
  logoURL: string;
  websiteURL: string;
  contactEmail: string;
  ownerUserID: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMemberPayload {
  id: string;
  organizationID: string;
  userID: string;
  userNickname: string;
  role: OrganizationMemberRole;
  membershipStatus: OrganizationMembershipStatus;
  joinedAt: string;
}

export interface OrganizationInvitationPayload {
  id: string;
  organizationID: string;
  inviterID: string;
  inviteeEmail: string;
  status: OrganizationInvitationStatus;
  createdAt: string;
  /** Populated for `myPendingInvitations` (invitee list). */
  organizationName?: string | null;
  inviterNickname?: string | null;
}

export interface OrganizationNewsPayload {
  id: string;
  organizationID: string;
  authorUserID: string;
  authorNickname: string;
  title: string;
  description: string;
  imageURL: string;
  richMetadata?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMessagePayload {
  id: string;
  organizationID: string;
  authorUserID: string;
  authorNickname: string;
  body: string;
  createdAt: string;
}

export type OrganizationProjectTodoStatusGql = 'OPEN' | 'DONE';

export interface OrganizationProjectPayload {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationProjectMyCapabilitiesPayload {
  canEditTodos: boolean;
  canEditPurchases: boolean;
}

/** GFG-180 / GFG-179 pending cross-org invite row (participant org owner query). */
export interface OrganizationProjectOrgInvitePendingRowPayload {
  projectId: string;
  projectName: string;
  hostOrganizationId: string;
  hostOrganizationName: string;
  invitedAt: string;
  capabilitiesJson: string;
}

/** GFG-179 participation / invite mutation result. */
export interface OrganizationProjectOrgParticipationPayload {
  id: string;
  projectId: string;
  participantOrganizationId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED';
  capabilitiesJson: string;
  invitedByUserId?: string | null;
  invitedAt: string;
  respondedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GFG-174 organization owner dashboard payload. */
export interface OrganizationOwnerDashboardDayBucketPayload {
  day: string;
  completedCount: number;
}

export interface OrganizationOwnerProjectDoneInPeriodPayload {
  projectId: string | null;
  projectName: string | null;
  isGeneral: boolean;
  count: number;
}

export interface OrganizationOwnerAssigneeSlicePayload {
  userId: string | null;
  nickname: string | null;
  openCount: number;
}

export interface OrganizationOwnerTodoDashboardPayload {
  organizationId: string;
  period: 'WEEK' | 'MONTH';
  includeSubtasks: boolean;
  periodStart: string;
  periodEnd: string;
  previousPeriodStart: string;
  previousPeriodEnd: string;
  openCount: number;
  doneCount: number;
  completedInSelectedPeriod: number;
  completedInPreviousPeriod: number;
  dailySeries: OrganizationOwnerDashboardDayBucketPayload[];
  donutOpenCount: number;
  donutDoneCount: number;
  doneInPeriodByProject: OrganizationOwnerProjectDoneInPeriodPayload[];
  openByAssignee: OrganizationOwnerAssigneeSlicePayload[];
}

export interface OrganizationProjectMemberPayload {
  id: string;
  projectId: string;
  userId: string;
  userNickname: string;
  addedAt: string;
}

export interface OrganizationProjectTodoSubtaskPayload {
  id: string;
  projectTodoId: string;
  title: string;
  completed: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationProjectTodoPayload {
  id: string;
  projectId: string;
  title: string;
  status: OrganizationProjectTodoStatusGql;
  createdByUserId: string;
  assignedToUserId?: string | null;
  dueAt?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Set by client when server schema lacks dueAt and the task was saved without a due time. */
  _dueAtNotSaved?: boolean;
  /** Present when mf-go supports GFG-117 subtasks; omitted on older servers. */
  subtasks?: OrganizationProjectTodoSubtaskPayload[];
}

export type OrganizationProjectPurchaseStatusGql = 'REQUESTED' | 'PURCHASED' | 'CANCELLED';

export interface OrganizationProjectPurchasePayload {
  id: string;
  projectId: string;
  productName: string;
  taxRate: number;
  productPurpose: string;
  price: number;
  quantity: number;
  productLink?: string | null;
  status: OrganizationProjectPurchaseStatusGql;
  statusNote: string;
  currency: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

const MY_ORGANIZATIONS = /* GraphQL */ `
  query MyOrganizations {
    myOrganizations {
      id name description logoURL websiteURL contactEmail ownerUserID createdAt updatedAt
    }
  }
`;

const ORGANIZATION = /* GraphQL */ `
  query Organization($organizationId: UUID!) {
    organization(organizationId: $organizationId) {
      id name description logoURL websiteURL contactEmail ownerUserID createdAt updatedAt
    }
  }
`;

const MY_PENDING_INVITATIONS = /* GraphQL */ `
  query MyPendingInvitations {
    myPendingInvitations {
      id organizationID inviterID inviteeEmail status createdAt organizationName inviterNickname
    }
  }
`;

const ORGANIZATION_MEMBERS = /* GraphQL */ `
  query OrganizationMembers($orgId: UUID!) {
    organizationMembers(orgId: $orgId) {
      id organizationID userID userNickname role membershipStatus joinedAt
    }
  }
`;

const ORGANIZATION_INVITATIONS = /* GraphQL */ `
  query OrganizationInvitations($orgId: UUID!) {
    organizationInvitations(orgId: $orgId) {
      id organizationID inviterID inviteeEmail status createdAt
    }
  }
`;

const ORGANIZATION_NEWS = /* GraphQL */ `
  query OrganizationNews($organizationId: UUID!, $limit: Int, $before: Time) {
    organizationNews(organizationId: $organizationId, limit: $limit, before: $before) {
      id organizationID authorUserID authorNickname title description imageURL richMetadata createdAt updatedAt
    }
  }
`;

const ORGANIZATION_MESSAGES = /* GraphQL */ `
  query OrganizationMessages($organizationId: UUID!, $limit: Int, $before: Time) {
    organizationMessages(organizationId: $organizationId, limit: $limit, before: $before) {
      id organizationID authorUserID authorNickname body createdAt
    }
  }
`;

const CREATE_ORGANIZATION = /* GraphQL */ `
  mutation CreateOrganization($input: CreateOrganizationInput!) {
    createOrganization(input: $input) {
      id name description logoURL websiteURL contactEmail ownerUserID createdAt updatedAt
    }
  }
`;

const UPDATE_ORGANIZATION = /* GraphQL */ `
  mutation UpdateOrganization($input: UpdateOrganizationInput!) {
    updateOrganization(input: $input) {
      id name description logoURL websiteURL contactEmail ownerUserID createdAt updatedAt
    }
  }
`;

const REMOVE_ORGANIZATION_MEMBER = /* GraphQL */ `
  mutation RemoveOrganizationMember($organizationId: UUID!, $userId: UUID!) {
    removeOrganizationMember(organizationId: $organizationId, userId: $userId)
  }
`;

const LEAVE_ORGANIZATION = /* GraphQL */ `
  mutation LeaveOrganization($organizationId: UUID!) {
    leaveOrganization(organizationId: $organizationId)
  }
`;

const SET_ORGANIZATION_MEMBER_SUSPENDED = /* GraphQL */ `
  mutation SetOrganizationMemberSuspended($organizationId: UUID!, $userId: UUID!, $suspended: Boolean!) {
    setOrganizationMemberSuspended(organizationId: $organizationId, userId: $userId, suspended: $suspended)
  }
`;

const INVITE_TO_ORGANIZATION = /* GraphQL */ `
  mutation InviteToOrganization($input: InviteToOrganizationInput!) {
    inviteToOrganization(input: $input) {
      id organizationID inviterID inviteeEmail status createdAt
    }
  }
`;

const ACCEPT_INVITATION = /* GraphQL */ `
  mutation AcceptInvitation($invitationId: UUID!) {
    acceptInvitation(invitationId: $invitationId) {
      id organizationID inviterID inviteeEmail status createdAt
    }
  }
`;

const DECLINE_INVITATION = /* GraphQL */ `
  mutation DeclineInvitation($invitationId: UUID!) {
    declineInvitation(invitationId: $invitationId) {
      id organizationID inviterID inviteeEmail status createdAt
    }
  }
`;

const REVOKE_ORGANIZATION_INVITATION = /* GraphQL */ `
  mutation RevokeOrganizationInvitation($invitationId: UUID!) {
    revokeOrganizationInvitation(invitationId: $invitationId) {
      id organizationID inviterID inviteeEmail status createdAt
    }
  }
`;

const RESEND_ORGANIZATION_INVITATION = /* GraphQL */ `
  mutation ResendOrganizationInvitation($invitationId: UUID!) {
    resendOrganizationInvitation(invitationId: $invitationId) {
      id organizationID inviterID inviteeEmail status createdAt
    }
  }
`;

const CREATE_ORGANIZATION_NEWS = /* GraphQL */ `
  mutation CreateOrganizationNews($input: CreateOrganizationNewsInput!) {
    createOrganizationNews(input: $input) {
      id organizationID authorUserID authorNickname title description imageURL richMetadata createdAt updatedAt
    }
  }
`;

const UPDATE_ORGANIZATION_NEWS = /* GraphQL */ `
  mutation UpdateOrganizationNews($input: UpdateOrganizationNewsInput!) {
    updateOrganizationNews(input: $input) {
      id organizationID authorUserID authorNickname title description imageURL richMetadata createdAt updatedAt
    }
  }
`;

const DELETE_ORGANIZATION_NEWS = /* GraphQL */ `
  mutation DeleteOrganizationNews($newsId: UUID!) {
    deleteOrganizationNews(newsId: $newsId)
  }
`;

const POST_ORGANIZATION_MESSAGE = /* GraphQL */ `
  mutation PostOrganizationMessage($organizationId: UUID!, $body: String!) {
    postOrganizationMessage(organizationId: $organizationId, body: $body) {
      id organizationID authorUserID authorNickname body createdAt
    }
  }
`;

const DELETE_ORGANIZATION_MESSAGE = /* GraphQL */ `
  mutation DeleteOrganizationMessage($organizationId: UUID!, $messageId: UUID!) {
    deleteOrganizationMessage(organizationId: $organizationId, messageId: $messageId)
  }
`;

const ORGANIZATION_PROJECTS = /* GraphQL */ `
  query OrganizationProjects($organizationId: UUID!) {
    organizationProjects(organizationId: $organizationId) {
      id organizationId name description createdByUserId createdAt updatedAt
    }
  }
`;

const ORGANIZATION_PROJECT = /* GraphQL */ `
  query OrganizationProject($projectId: UUID!) {
    organizationProject(projectId: $projectId) {
      id organizationId name description createdByUserId createdAt updatedAt
    }
  }
`;

const ORGANIZATION_PROJECT_MY_CAPABILITIES = /* GraphQL */ `
  query OrganizationProjectMyCapabilities($projectId: UUID!) {
    organizationProjectMyCapabilities(projectId: $projectId) {
      canEditTodos
      canEditPurchases
    }
  }
`;

const ORGANIZATION_PROJECT_MEMBERS = /* GraphQL */ `
  query OrganizationProjectMembers($projectId: UUID!) {
    organizationProjectMembers(projectId: $projectId) {
      id projectId userId userNickname addedAt
    }
  }
`;

const ORGANIZATION_PROJECT_TODOS = /* GraphQL */ `
  query OrganizationProjectTodos($projectId: UUID!) {
    organizationProjectTodos(projectId: $projectId) {
      id projectId title status createdByUserId assignedToUserId dueAt createdAt updatedAt
      subtasks {
        id projectTodoId title completed sortOrder createdAt updatedAt
      }
    }
  }
`;

const ORGANIZATION_PROJECT_TODOS_NO_SUBTASKS = /* GraphQL */ `
  query OrganizationProjectTodosNoSubtasks($projectId: UUID!) {
    organizationProjectTodos(projectId: $projectId) {
      id projectId title status createdByUserId assignedToUserId dueAt createdAt updatedAt
    }
  }
`;

const CREATE_ORGANIZATION_PROJECT = /* GraphQL */ `
  mutation CreateOrganizationProject($input: CreateOrganizationProjectInput!) {
    createOrganizationProject(input: $input) {
      id organizationId name description createdByUserId createdAt updatedAt
    }
  }
`;

const UPDATE_ORGANIZATION_PROJECT = /* GraphQL */ `
  mutation UpdateOrganizationProject($input: UpdateOrganizationProjectInput!) {
    updateOrganizationProject(input: $input) {
      id organizationId name description createdByUserId createdAt updatedAt
    }
  }
`;

const DELETE_ORGANIZATION_PROJECT = /* GraphQL */ `
  mutation DeleteOrganizationProject($projectId: UUID!) {
    deleteOrganizationProject(projectId: $projectId)
  }
`;

const ADD_ORGANIZATION_PROJECT_MEMBER = /* GraphQL */ `
  mutation AddOrganizationProjectMember($projectId: UUID!, $userId: UUID!) {
    addOrganizationProjectMember(projectId: $projectId, userId: $userId)
  }
`;

const REMOVE_ORGANIZATION_PROJECT_MEMBER = /* GraphQL */ `
  mutation RemoveOrganizationProjectMember($projectId: UUID!, $userId: UUID!) {
    removeOrganizationProjectMember(projectId: $projectId, userId: $userId)
  }
`;

const CREATE_ORGANIZATION_PROJECT_TODO = /* GraphQL */ `
  mutation CreateOrganizationProjectTodo($input: CreateOrganizationProjectTodoInput!) {
    createOrganizationProjectTodo(input: $input) {
      id projectId title status createdByUserId assignedToUserId dueAt createdAt updatedAt
    }
  }
`;

const UPDATE_ORGANIZATION_PROJECT_TODO = /* GraphQL */ `
  mutation UpdateOrganizationProjectTodo($input: UpdateOrganizationProjectTodoInput!) {
    updateOrganizationProjectTodo(input: $input) {
      id projectId title status createdByUserId assignedToUserId dueAt createdAt updatedAt
    }
  }
`;

/** Older mf-go: no dueAt on OrganizationProjectTodo (GraphQL + DB). */
const CREATE_ORGANIZATION_PROJECT_TODO_NO_DUE = /* GraphQL */ `
  mutation CreateOrganizationProjectTodoNoDue($input: CreateOrganizationProjectTodoInput!) {
    createOrganizationProjectTodo(input: $input) {
      id projectId title status createdByUserId assignedToUserId createdAt updatedAt
    }
  }
`;

const UPDATE_ORGANIZATION_PROJECT_TODO_NO_DUE = /* GraphQL */ `
  mutation UpdateOrganizationProjectTodoNoDue($input: UpdateOrganizationProjectTodoInput!) {
    updateOrganizationProjectTodo(input: $input) {
      id projectId title status createdByUserId assignedToUserId createdAt updatedAt
    }
  }
`;

const DELETE_ORGANIZATION_PROJECT_TODO = /* GraphQL */ `
  mutation DeleteOrganizationProjectTodo($todoId: UUID!) {
    deleteOrganizationProjectTodo(todoId: $todoId)
  }
`;

const CREATE_ORGANIZATION_PROJECT_TODO_SUBTASK = /* GraphQL */ `
  mutation CreateOrganizationProjectTodoSubtask($input: CreateOrganizationProjectTodoSubtaskInput!) {
    createOrganizationProjectTodoSubtask(input: $input) {
      id projectTodoId title completed sortOrder createdAt updatedAt
    }
  }
`;

const UPDATE_ORGANIZATION_PROJECT_TODO_SUBTASK = /* GraphQL */ `
  mutation UpdateOrganizationProjectTodoSubtask($input: UpdateOrganizationProjectTodoSubtaskInput!) {
    updateOrganizationProjectTodoSubtask(input: $input) {
      id projectTodoId title completed sortOrder createdAt updatedAt
    }
  }
`;

const DELETE_ORGANIZATION_PROJECT_TODO_SUBTASK = /* GraphQL */ `
  mutation DeleteOrganizationProjectTodoSubtask($id: UUID!) {
    deleteOrganizationProjectTodoSubtask(id: $id)
  }
`;

const ORGANIZATION_PROJECT_PURCHASES = /* GraphQL */ `
  query OrganizationProjectPurchases($projectId: UUID!) {
    organizationProjectPurchases(projectId: $projectId) {
      id projectId productName taxRate productPurpose price quantity productLink status statusNote currency createdByUserId createdAt updatedAt
    }
  }
`;

const CREATE_ORGANIZATION_PROJECT_PURCHASE = /* GraphQL */ `
  mutation CreateOrganizationProjectPurchase($input: CreateOrganizationProjectPurchaseInput!) {
    createOrganizationProjectPurchase(input: $input) {
      id projectId productName taxRate productPurpose price quantity productLink status statusNote currency createdByUserId createdAt updatedAt
    }
  }
`;

const UPDATE_ORGANIZATION_PROJECT_PURCHASE = /* GraphQL */ `
  mutation UpdateOrganizationProjectPurchase($input: UpdateOrganizationProjectPurchaseInput!) {
    updateOrganizationProjectPurchase(input: $input) {
      id projectId productName taxRate productPurpose price quantity productLink status statusNote currency createdByUserId createdAt updatedAt
    }
  }
`;

const DELETE_ORGANIZATION_PROJECT_PURCHASE = /* GraphQL */ `
  mutation DeleteOrganizationProjectPurchase($purchaseId: UUID!) {
    deleteOrganizationProjectPurchase(purchaseId: $purchaseId)
  }
`;

const PENDING_ORGANIZATION_PROJECT_ORG_INVITES = /* GraphQL */ `
  query PendingOrganizationProjectOrgInvites($organizationId: UUID!) {
    pendingOrganizationProjectOrgInvites(organizationId: $organizationId) {
      projectId
      projectName
      hostOrganizationId
      hostOrganizationName
      invitedAt
      capabilitiesJson
    }
  }
`;

const CREATE_ORGANIZATION_PROJECT_ORG_INVITE = /* GraphQL */ `
  mutation CreateOrganizationProjectOrgInvite($input: CreateOrganizationProjectOrgInviteInput!) {
    createOrganizationProjectOrgInvite(input: $input) {
      id
      projectId
      participantOrganizationId
      status
      capabilitiesJson
      invitedByUserId
      invitedAt
      respondedAt
      createdAt
      updatedAt
    }
  }
`;

const ACCEPT_ORGANIZATION_PROJECT_ORG_INVITE = /* GraphQL */ `
  mutation AcceptOrganizationProjectOrgInvite($projectId: UUID!, $participantOrganizationId: UUID!) {
    acceptOrganizationProjectOrgInvite(
      projectId: $projectId
      participantOrganizationId: $participantOrganizationId
    ) {
      id
      projectId
      participantOrganizationId
      status
      capabilitiesJson
      invitedByUserId
      invitedAt
      respondedAt
      createdAt
      updatedAt
    }
  }
`;

const DECLINE_ORGANIZATION_PROJECT_ORG_INVITE = /* GraphQL */ `
  mutation DeclineOrganizationProjectOrgInvite($projectId: UUID!, $participantOrganizationId: UUID!) {
    declineOrganizationProjectOrgInvite(
      projectId: $projectId
      participantOrganizationId: $participantOrganizationId
    ) {
      id
      projectId
      participantOrganizationId
      status
      capabilitiesJson
      invitedByUserId
      invitedAt
      respondedAt
      createdAt
      updatedAt
    }
  }
`;

const ORGANIZATION_OWNER_TODO_DASHBOARD = /* GraphQL */ `
  query OrganizationOwnerTodoDashboard($input: OrganizationOwnerTodoDashboardInput!) {
    organizationOwnerTodoDashboard(input: $input) {
      organizationId
      period
      includeSubtasks
      periodStart
      periodEnd
      previousPeriodStart
      previousPeriodEnd
      openCount
      doneCount
      completedInSelectedPeriod
      completedInPreviousPeriod
      dailySeries { day completedCount }
      donutOpenCount
      donutDoneCount
      doneInPeriodByProject { projectId projectName isGeneral count }
      openByAssignee { userId nickname openCount }
    }
  }
`;

/** graphql-ws subscription document (pass `organizationId` as variable). */
export const ORGANIZATION_MESSAGE_CREATED_SUBSCRIPTION = /* GraphQL */ `
  subscription OrganizationMessageCreated($organizationId: UUID!) {
    organizationMessageCreated(organizationId: $organizationId) {
      id organizationID authorUserID authorNickname body createdAt
    }
  }
`;

export const mfGoOrganizations = {
  myOrganizations: () =>
    graphqlRequest<{ myOrganizations: OrganizationPayload[] }>(MY_ORGANIZATIONS).then(
      (r) => r.myOrganizations
    ),

  organization: (organizationId: string) =>
    graphqlRequest<{ organization: OrganizationPayload }>(ORGANIZATION, { organizationId }).then(
      (r) => r.organization
    ),

  organizationOwnerTodoDashboard: (input: {
    organizationId: string;
    period: 'WEEK' | 'MONTH';
    periodOffset: number;
    includeSubtasks: boolean;
    projectIds?: string[] | null;
  }) =>
    graphqlRequest<{ organizationOwnerTodoDashboard: OrganizationOwnerTodoDashboardPayload }>(
      ORGANIZATION_OWNER_TODO_DASHBOARD,
      {
        input: {
          organizationId: input.organizationId,
          period: input.period,
          periodOffset: input.periodOffset,
          includeSubtasks: input.includeSubtasks,
          projectIds: input.projectIds?.length ? input.projectIds : undefined,
        },
      }
    ).then((r) => r.organizationOwnerTodoDashboard),

  myPendingInvitations: () =>
    graphqlRequest<{ myPendingInvitations: OrganizationInvitationPayload[] }>(
      MY_PENDING_INVITATIONS
    ).then((r) => r.myPendingInvitations),

  organizationMembers: (orgId: string) =>
    graphqlRequest<{ organizationMembers: OrganizationMemberPayload[] }>(
      ORGANIZATION_MEMBERS,
      { orgId }
    ).then((r) => r.organizationMembers),

  organizationInvitations: (orgId: string) =>
    graphqlRequest<{ organizationInvitations: OrganizationInvitationPayload[] }>(
      ORGANIZATION_INVITATIONS,
      { orgId }
    ).then((r) => r.organizationInvitations),

  organizationNews: (organizationId: string, limit?: number, before?: string | null) =>
    graphqlRequest<{ organizationNews: OrganizationNewsPayload[] }>(ORGANIZATION_NEWS, {
      organizationId,
      limit: limit ?? 50,
      before: before ?? null,
    }).then((r) => r.organizationNews),

  organizationMessages: (organizationId: string, limit?: number, before?: string | null) =>
    graphqlRequest<{ organizationMessages: OrganizationMessagePayload[] }>(ORGANIZATION_MESSAGES, {
      organizationId,
      limit: limit ?? 50,
      before: before ?? null,
    }).then((r) => r.organizationMessages),

  createOrganization: (name: string) =>
    graphqlRequest<{ createOrganization: OrganizationPayload }>(CREATE_ORGANIZATION, {
      input: { name },
    }).then((r) => r.createOrganization),

  updateOrganization: (input: {
    organizationId: string;
    name?: string | null;
    description?: string | null;
    logoURL?: string | null;
    websiteURL?: string | null;
    contactEmail?: string | null;
  }) =>
    graphqlRequest<{ updateOrganization: OrganizationPayload }>(UPDATE_ORGANIZATION, {
      input: {
        organizationId: input.organizationId,
        name: input.name ?? undefined,
        description: input.description ?? undefined,
        logoURL: input.logoURL ?? undefined,
        websiteURL: input.websiteURL ?? undefined,
        contactEmail: input.contactEmail ?? undefined,
      },
    }).then((r) => r.updateOrganization),

  removeOrganizationMember: (organizationId: string, userId: string) =>
    graphqlRequest<{ removeOrganizationMember: boolean }>(REMOVE_ORGANIZATION_MEMBER, {
      organizationId,
      userId,
    }).then((r) => r.removeOrganizationMember),

  leaveOrganization: (organizationId: string) =>
    graphqlRequest<{ leaveOrganization: boolean }>(LEAVE_ORGANIZATION, {
      organizationId,
    }).then((r) => r.leaveOrganization),

  setOrganizationMemberSuspended: (
    organizationId: string,
    userId: string,
    suspended: boolean
  ) =>
    graphqlRequest<{ setOrganizationMemberSuspended: boolean }>(
      SET_ORGANIZATION_MEMBER_SUSPENDED,
      { organizationId, userId, suspended }
    ).then((r) => r.setOrganizationMemberSuspended),

  inviteToOrganization: (organizationId: string, inviteeEmail: string) =>
    graphqlRequest<{ inviteToOrganization: OrganizationInvitationPayload }>(
      INVITE_TO_ORGANIZATION,
      { input: { organizationId, inviteeEmail } }
    ).then((r) => r.inviteToOrganization),

  acceptInvitation: (invitationId: string) =>
    graphqlRequest<{ acceptInvitation: OrganizationInvitationPayload }>(
      ACCEPT_INVITATION,
      { invitationId }
    ).then((r) => r.acceptInvitation),

  declineInvitation: (invitationId: string) =>
    graphqlRequest<{ declineInvitation: OrganizationInvitationPayload }>(
      DECLINE_INVITATION,
      { invitationId }
    ).then((r) => r.declineInvitation),

  revokeOrganizationInvitation: (invitationId: string) =>
    graphqlRequest<{ revokeOrganizationInvitation: OrganizationInvitationPayload }>(
      REVOKE_ORGANIZATION_INVITATION,
      { invitationId }
    ).then((r) => r.revokeOrganizationInvitation),

  resendOrganizationInvitation: (invitationId: string) =>
    graphqlRequest<{ resendOrganizationInvitation: OrganizationInvitationPayload }>(
      RESEND_ORGANIZATION_INVITATION,
      { invitationId }
    ).then((r) => r.resendOrganizationInvitation),

  createOrganizationNews: (input: {
    organizationId: string;
    title: string;
    description?: string;
    imageURL?: string;
    richMetadata?: string;
  }) =>
    graphqlRequest<{ createOrganizationNews: OrganizationNewsPayload }>(CREATE_ORGANIZATION_NEWS, {
      input: {
        organizationId: input.organizationId,
        title: input.title,
        description: input.description,
        imageURL: input.imageURL,
        richMetadata: input.richMetadata,
      },
    }).then((r) => r.createOrganizationNews),

  updateOrganizationNews: (input: {
    newsId: string;
    title?: string;
    description?: string;
    imageURL?: string;
    richMetadata?: string;
  }) =>
    graphqlRequest<{ updateOrganizationNews: OrganizationNewsPayload }>(UPDATE_ORGANIZATION_NEWS, {
      input: {
        newsId: input.newsId,
        title: input.title,
        description: input.description,
        imageURL: input.imageURL,
        richMetadata: input.richMetadata,
      },
    }).then((r) => r.updateOrganizationNews),

  deleteOrganizationNews: (newsId: string) =>
    graphqlRequest<{ deleteOrganizationNews: boolean }>(DELETE_ORGANIZATION_NEWS, {
      newsId,
    }).then((r) => r.deleteOrganizationNews),

  postOrganizationMessage: (organizationId: string, body: string) =>
    graphqlRequest<{ postOrganizationMessage: OrganizationMessagePayload }>(
      POST_ORGANIZATION_MESSAGE,
      { organizationId, body }
    ).then((r) => r.postOrganizationMessage),

  deleteOrganizationMessage: (organizationId: string, messageId: string) =>
    graphqlRequest<{ deleteOrganizationMessage: boolean }>(DELETE_ORGANIZATION_MESSAGE, {
      organizationId,
      messageId,
    }).then((r) => r.deleteOrganizationMessage),

  organizationProjects: (organizationId: string) =>
    graphqlRequest<{ organizationProjects: OrganizationProjectPayload[] }>(ORGANIZATION_PROJECTS, {
      organizationId,
    }).then((r) => r.organizationProjects),

  organizationProject: (projectId: string) =>
    graphqlRequest<{ organizationProject: OrganizationProjectPayload }>(ORGANIZATION_PROJECT, {
      projectId,
    }).then((r) => r.organizationProject),

  organizationProjectMyCapabilities: (projectId: string) =>
    graphqlRequest<{ organizationProjectMyCapabilities: OrganizationProjectMyCapabilitiesPayload }>(
      ORGANIZATION_PROJECT_MY_CAPABILITIES,
      { projectId }
    ).then((r) => r.organizationProjectMyCapabilities),

  organizationProjectMembers: (projectId: string) =>
    graphqlRequest<{ organizationProjectMembers: OrganizationProjectMemberPayload[] }>(
      ORGANIZATION_PROJECT_MEMBERS,
      { projectId }
    ).then((r) => r.organizationProjectMembers),

  organizationProjectTodos: async (projectId: string) => {
    try {
      const r = await graphqlRequest<{ organizationProjectTodos: OrganizationProjectTodoPayload[] }>(
        ORGANIZATION_PROJECT_TODOS,
        { projectId }
      );
      return r.organizationProjectTodos;
    } catch (e) {
      if (!isSubtasksSchemaMismatchError(e)) throw e;
      const r = await graphqlRequest<{ organizationProjectTodos: OrganizationProjectTodoPayload[] }>(
        ORGANIZATION_PROJECT_TODOS_NO_SUBTASKS,
        { projectId },
        { silent: true }
      );
      return r.organizationProjectTodos;
    }
  },

  organizationProjectPurchases: (projectId: string) =>
    graphqlRequest<{ organizationProjectPurchases: OrganizationProjectPurchasePayload[] }>(
      ORGANIZATION_PROJECT_PURCHASES,
      { projectId }
    ).then((r) => r.organizationProjectPurchases),

  createOrganizationProject: (input: {
    organizationId: string;
    name: string;
    description?: string | null;
  }) =>
    graphqlRequest<{ createOrganizationProject: OrganizationProjectPayload }>(
      CREATE_ORGANIZATION_PROJECT,
      {
        input: {
          organizationId: input.organizationId,
          name: input.name,
          description: input.description ?? undefined,
        },
      }
    ).then((r) => r.createOrganizationProject),

  updateOrganizationProject: (input: {
    projectId: string;
    name?: string | null;
    description?: string | null;
  }) =>
    graphqlRequest<{ updateOrganizationProject: OrganizationProjectPayload }>(
      UPDATE_ORGANIZATION_PROJECT,
      {
        input: {
          projectId: input.projectId,
          name: input.name ?? undefined,
          description: input.description ?? undefined,
        },
      }
    ).then((r) => r.updateOrganizationProject),

  deleteOrganizationProject: (projectId: string) =>
    graphqlRequest<{ deleteOrganizationProject: boolean }>(DELETE_ORGANIZATION_PROJECT, {
      projectId,
    }).then((r) => r.deleteOrganizationProject),

  pendingOrganizationProjectOrgInvites: (organizationId: string) =>
    graphqlRequest<{
      pendingOrganizationProjectOrgInvites: OrganizationProjectOrgInvitePendingRowPayload[];
    }>(PENDING_ORGANIZATION_PROJECT_ORG_INVITES, { organizationId }).then(
      (r) => r.pendingOrganizationProjectOrgInvites
    ),

  createOrganizationProjectOrgInvite: (input: {
    projectId: string;
    participantOrganizationId: string;
    capabilitiesJson?: string;
  }) =>
    graphqlRequest<{ createOrganizationProjectOrgInvite: OrganizationProjectOrgParticipationPayload }>(
      CREATE_ORGANIZATION_PROJECT_ORG_INVITE,
      {
        input: {
          projectId: input.projectId,
          participantOrganizationId: input.participantOrganizationId,
          capabilitiesJson: input.capabilitiesJson,
        },
      }
    ).then((r) => r.createOrganizationProjectOrgInvite),

  acceptOrganizationProjectOrgInvite: (projectId: string, participantOrganizationId: string) =>
    graphqlRequest<{ acceptOrganizationProjectOrgInvite: OrganizationProjectOrgParticipationPayload }>(
      ACCEPT_ORGANIZATION_PROJECT_ORG_INVITE,
      { projectId, participantOrganizationId }
    ).then((r) => r.acceptOrganizationProjectOrgInvite),

  declineOrganizationProjectOrgInvite: (projectId: string, participantOrganizationId: string) =>
    graphqlRequest<{ declineOrganizationProjectOrgInvite: OrganizationProjectOrgParticipationPayload }>(
      DECLINE_ORGANIZATION_PROJECT_ORG_INVITE,
      { projectId, participantOrganizationId }
    ).then((r) => r.declineOrganizationProjectOrgInvite),

  addOrganizationProjectMember: (projectId: string, userId: string) =>
    graphqlRequest<{ addOrganizationProjectMember: boolean }>(ADD_ORGANIZATION_PROJECT_MEMBER, {
      projectId,
      userId,
    }).then((r) => r.addOrganizationProjectMember),

  removeOrganizationProjectMember: (projectId: string, userId: string) =>
    graphqlRequest<{ removeOrganizationProjectMember: boolean }>(
      REMOVE_ORGANIZATION_PROJECT_MEMBER,
      { projectId, userId }
    ).then((r) => r.removeOrganizationProjectMember),

  createOrganizationProjectTodo: async (input: {
    projectId: string;
    title: string;
    assignedToUserId?: string | null;
    dueAt?: string | null;
  }) => {
    try {
      const r = await graphqlRequest<{ createOrganizationProjectTodo: OrganizationProjectTodoPayload }>(
        CREATE_ORGANIZATION_PROJECT_TODO,
        {
          input: {
            projectId: input.projectId,
            title: input.title,
            ...(input.assignedToUserId ? { assignedToUserId: input.assignedToUserId } : {}),
            ...(input.dueAt ? { dueAt: input.dueAt } : {}),
          },
        }
      );
      return r.createOrganizationProjectTodo;
    } catch (e) {
      if (!isDueAtSchemaMismatchError(e)) throw e;
      const r = await graphqlRequest<{ createOrganizationProjectTodo: OrganizationProjectTodoPayload }>(
        CREATE_ORGANIZATION_PROJECT_TODO_NO_DUE,
        {
          input: {
            projectId: input.projectId,
            title: input.title,
            ...(input.assignedToUserId ? { assignedToUserId: input.assignedToUserId } : {}),
          },
        },
        { silent: true }
      );
      return {
        ...r.createOrganizationProjectTodo,
        ...(input.dueAt ? { _dueAtNotSaved: true as const } : {}),
      };
    }
  },

  updateOrganizationProjectTodo: async (input: {
    todoId: string;
    title?: string | null;
    status?: OrganizationProjectTodoStatusGql | null;
    dueAt?: string | null;
    clearDueAt?: boolean;
  }) => {
    const fullInput = {
      todoId: input.todoId,
      title: input.title ?? undefined,
      status: input.status ?? undefined,
      ...(input.dueAt ? { dueAt: input.dueAt } : {}),
      ...(input.clearDueAt ? { clearDueAt: true } : {}),
    };
    try {
      const r = await graphqlRequest<{ updateOrganizationProjectTodo: OrganizationProjectTodoPayload }>(
        UPDATE_ORGANIZATION_PROJECT_TODO,
        { input: fullInput }
      );
      return r.updateOrganizationProjectTodo;
    } catch (e) {
      if (!isDueAtSchemaMismatchError(e)) throw e;
      const legacyInput: {
        todoId: string;
        title?: string;
        status?: OrganizationProjectTodoStatusGql;
      } = { todoId: input.todoId };
      if (input.title !== undefined && input.title !== null) legacyInput.title = input.title;
      if (input.status !== undefined && input.status !== null) legacyInput.status = input.status;
      const r = await graphqlRequest<{ updateOrganizationProjectTodo: OrganizationProjectTodoPayload }>(
        UPDATE_ORGANIZATION_PROJECT_TODO_NO_DUE,
        { input: legacyInput },
        { silent: true }
      );
      const hadDueIntent = Boolean(input.dueAt) || input.clearDueAt === true;
      return {
        ...r.updateOrganizationProjectTodo,
        ...(hadDueIntent ? { _dueAtNotSaved: true as const } : {}),
      };
    }
  },

  deleteOrganizationProjectTodo: (todoId: string) =>
    graphqlRequest<{ deleteOrganizationProjectTodo: boolean }>(DELETE_ORGANIZATION_PROJECT_TODO, {
      todoId,
    }).then((r) => r.deleteOrganizationProjectTodo),

  createOrganizationProjectTodoSubtask: (input: {
    projectTodoId: string;
    title: string;
    completed?: boolean;
  }) =>
    graphqlRequest<{ createOrganizationProjectTodoSubtask: OrganizationProjectTodoSubtaskPayload }>(
      CREATE_ORGANIZATION_PROJECT_TODO_SUBTASK,
      {
        input: {
          projectTodoId: input.projectTodoId,
          title: input.title,
          ...(input.completed !== undefined ? { completed: input.completed } : {}),
        },
      }
    ).then((r) => r.createOrganizationProjectTodoSubtask),

  updateOrganizationProjectTodoSubtask: (input: {
    id: string;
    title?: string;
    completed?: boolean;
  }) => {
    const body: { id: string; title?: string; completed?: boolean } = { id: input.id };
    if (input.title !== undefined) body.title = input.title;
    if (input.completed !== undefined) body.completed = input.completed;
    return graphqlRequest<{ updateOrganizationProjectTodoSubtask: OrganizationProjectTodoSubtaskPayload }>(
      UPDATE_ORGANIZATION_PROJECT_TODO_SUBTASK,
      { input: body }
    ).then((r) => r.updateOrganizationProjectTodoSubtask);
  },

  deleteOrganizationProjectTodoSubtask: (id: string) =>
    graphqlRequest<{ deleteOrganizationProjectTodoSubtask: boolean }>(
      DELETE_ORGANIZATION_PROJECT_TODO_SUBTASK,
      { id }
    ).then((r) => r.deleteOrganizationProjectTodoSubtask),

  createOrganizationProjectPurchase: (input: {
    projectId: string;
    productName: string;
    taxRate?: number | null;
    productPurpose?: string | null;
    price: number;
    quantity?: number | null;
    productLink?: string | null;
    currency?: string | null;
    status?: OrganizationProjectPurchaseStatusGql | null;
    statusNote?: string | null;
  }) => {
    const body: Record<string, unknown> = {
      projectId: input.projectId,
      productName: input.productName.trim(),
      price: input.price,
    };
    if (input.taxRate != null && input.taxRate !== undefined) body.taxRate = input.taxRate;
    if (input.productPurpose != null) body.productPurpose = input.productPurpose;
    if (input.quantity != null && input.quantity !== undefined) body.quantity = input.quantity;
    const link = input.productLink?.trim();
    if (link) body.productLink = link;
    const cur = input.currency?.trim().toUpperCase();
    if (cur) body.currency = cur;
    if (input.status) body.status = input.status;
    const note = input.statusNote?.trim();
    if (note) body.statusNote = note;
    return graphqlRequest<{ createOrganizationProjectPurchase: OrganizationProjectPurchasePayload }>(
      CREATE_ORGANIZATION_PROJECT_PURCHASE,
      { input: body }
    ).then((r) => r.createOrganizationProjectPurchase);
  },

  updateOrganizationProjectPurchase: (input: {
    purchaseId: string;
    productName: string;
    taxRate: number;
    productPurpose: string;
    price: number;
    quantity: number;
    productLink: string | null;
    currency: string;
    status: OrganizationProjectPurchaseStatusGql;
    statusNote: string;
  }) => {
    const gqlInput: Record<string, unknown> = {
      purchaseId: input.purchaseId,
      productName: input.productName.trim(),
      taxRate: input.taxRate,
      productPurpose: input.productPurpose,
      price: input.price,
      quantity: input.quantity,
      currency: input.currency.trim().toUpperCase(),
      status: input.status,
      statusNote: input.statusNote,
    };
    const link = input.productLink?.trim() ?? '';
    if (!link) {
      gqlInput.clearProductLink = true;
    } else {
      gqlInput.productLink = link;
    }
    return graphqlRequest<{ updateOrganizationProjectPurchase: OrganizationProjectPurchasePayload }>(
      UPDATE_ORGANIZATION_PROJECT_PURCHASE,
      { input: gqlInput }
    ).then((r) => r.updateOrganizationProjectPurchase);
  },

  deleteOrganizationProjectPurchase: (purchaseId: string) =>
    graphqlRequest<{ deleteOrganizationProjectPurchase: boolean }>(
      DELETE_ORGANIZATION_PROJECT_PURCHASE,
      { purchaseId }
    ).then((r) => r.deleteOrganizationProjectPurchase),
};

// ── Notifications ────────────────────────────────────────────────────────────

export interface NotificationPayload {
  id: string;
  title: string;
  subtitle?: string | null;
  message: string;
  type: string;
  category: string;
  icon?: string | null;
  language?: string | null;
  actionUrl?: string | null;
  imageUrl?: string | null;
  priority?: string | null;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

const NOTIFICATIONS = /* GraphQL */ `
  query Notifications($language: String, $limit: Int) {
    notifications(language: $language, limit: $limit) {
      id title subtitle message type category icon language actionUrl imageUrl priority isRead createdAt updatedAt
    }
  }
`;

/** Admin-only: full notifications table (no language filter). */
const ADMIN_NOTIFICATIONS = /* GraphQL */ `
  query AdminNotifications($limit: Int) {
    adminNotifications(limit: $limit) {
      id title subtitle message type category icon language actionUrl imageUrl priority isRead createdAt updatedAt
    }
  }
`;

const MARK_NOTIFICATION_READ = /* GraphQL */ `
  mutation MarkNotificationRead($id: UUID!) {
    markNotificationRead(id: $id)
  }
`;

const MARK_ALL_NOTIFICATIONS_READ = /* GraphQL */ `
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;

const ADMIN_CREATE_NOTIFICATION = /* GraphQL */ `
  mutation AdminCreateNotification($input: CreateNotificationInput!) {
    adminCreateNotification(input: $input) {
      id title subtitle message type category icon language actionUrl imageUrl priority isRead createdAt updatedAt
    }
  }
`;

const ADMIN_CLEAR_ALL_NOTIFICATIONS = /* GraphQL */ `
  mutation AdminClearAllNotifications {
    adminClearAllNotifications
  }
`;

const ADMIN_DELETE_NOTIFICATION = /* GraphQL */ `
  mutation AdminDeleteNotification($id: UUID!) {
    adminDeleteNotification(id: $id)
  }
`;

export const mfGoNotifications = {
  list: (options?: { language?: string; limit?: number }) => {
    const vars: Record<string, unknown> = {};
    if (options?.language != null) vars.language = options.language;
    if (options?.limit != null) vars.limit = options.limit;
    return graphqlRequest<{ notifications: NotificationPayload[] }>(
      NOTIFICATIONS,
      Object.keys(vars).length > 0 ? vars : undefined
    ).then((r) => r.notifications);
  },

  /** ADMIN role: every row in `notifications`, newest first (ignores locale). */
  adminList: (limit?: number) => {
    const vars: Record<string, unknown> = {};
    if (limit != null && limit > 0) vars.limit = limit;
    return graphqlRequest<{ adminNotifications: NotificationPayload[] }>(
      ADMIN_NOTIFICATIONS,
      Object.keys(vars).length > 0 ? vars : undefined
    ).then((r) => r.adminNotifications);
  },

  markAsRead: (id: string) =>
    graphqlRequest<{ markNotificationRead: boolean }>(MARK_NOTIFICATION_READ, {
      id,
    }).then((r) => r.markNotificationRead),

  markAllAsRead: () =>
    graphqlRequest<{ markAllNotificationsRead: boolean }>(
      MARK_ALL_NOTIFICATIONS_READ
    ).then((r) => r.markAllNotificationsRead),

  adminCreate: (input: {
    title: string;
    subtitle?: string;
    message: string;
    type?: string;
    category?: string;
    icon?: string;
    language?: string;
    actionUrl?: string;
    imageUrl?: string;
    priority?: string;
    /** When true, mf-go sends a OneSignal push to segment All (REST key on server only). */
    sendPush?: boolean;
  }) =>
    graphqlRequest<{ adminCreateNotification: NotificationPayload }>(
      ADMIN_CREATE_NOTIFICATION,
      { input }
    ).then((r) => r.adminCreateNotification),

  adminClearAll: () =>
    graphqlRequest<{ adminClearAllNotifications: boolean }>(
      ADMIN_CLEAR_ALL_NOTIFICATIONS
    ).then((r) => r.adminClearAllNotifications),

  adminDelete: (id: string) =>
    graphqlRequest<{ adminDeleteNotification: boolean }>(
      ADMIN_DELETE_NOTIFICATION,
      { id }
    ).then((r) => r.adminDeleteNotification),

  adminUpdate: (
    id: string,
    input: Partial<{
      title: string;
      subtitle: string;
      message: string;
      type: string;
      category: string;
      icon: string;
      language: string;
      actionUrl: string;
      imageUrl: string;
      priority: string;
    }>
  ) =>
    graphqlRequest<{ adminUpdateNotification: NotificationPayload }>(
      /* GraphQL */ `
        mutation AdminUpdateNotification($id: UUID!, $input: UpdateNotificationInput!) {
          adminUpdateNotification(id: $id, input: $input) {
            id title subtitle message type category icon language actionUrl imageUrl priority isRead createdAt updatedAt
          }
        }
      `,
      { id, input }
    ).then((r) => r.adminUpdateNotification),
};

// ── Todos ────────────────────────────────────────────────────────────────────

export interface UserTodoSubtaskPayload {
  id: string;
  userTodoId: string;
  title: string;
  completed: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserTodoPayload {
  id: string;
  userID: string;
  title: string;
  completed: boolean;
  organizationID?: string | null;
  assignedToUserID?: string | null;
  /** ISO8601 UTC when a due date/time is set */
  dueAt?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Set when server schema lacks dueAt and the task was saved without persisting due time. */
  _dueAtNotSaved?: boolean;
  /** Present when mf-go supports GFG-117 subtasks; omitted on older servers (fallback query). */
  subtasks?: UserTodoSubtaskPayload[];
}

const MY_TODOS = /* GraphQL */ `
  query MyTodos {
    myTodos {
      id userID title completed organizationID assignedToUserID dueAt createdAt updatedAt
    }
  }
`;

const MY_TODOS_WITH_SUBTASKS = /* GraphQL */ `
  query MyTodosWithSubtasks {
    myTodos {
      id userID title completed organizationID assignedToUserID dueAt createdAt updatedAt
      subtasks {
        id userTodoId title completed sortOrder createdAt updatedAt
      }
    }
  }
`;

const CREATE_TODO = /* GraphQL */ `
  mutation CreateTodo($input: CreateTodoInput!) {
    createTodo(input: $input) {
      id userID title completed organizationID assignedToUserID dueAt createdAt updatedAt
    }
  }
`;

const UPDATE_TODO = /* GraphQL */ `
  mutation UpdateTodo($input: UpdateTodoInput!) {
    updateTodo(input: $input) {
      id userID title completed organizationID assignedToUserID dueAt createdAt updatedAt
    }
  }
`;

/** Older mf-go: Todo type has no dueAt (GraphQL + DB). */
const CREATE_TODO_NO_DUE = /* GraphQL */ `
  mutation CreateTodoNoDue($input: CreateTodoInput!) {
    createTodo(input: $input) {
      id userID title completed organizationID assignedToUserID createdAt updatedAt
    }
  }
`;

const UPDATE_TODO_NO_DUE = /* GraphQL */ `
  mutation UpdateTodoNoDue($input: UpdateTodoInput!) {
    updateTodo(input: $input) {
      id userID title completed organizationID assignedToUserID createdAt updatedAt
    }
  }
`;

const DELETE_TODO = /* GraphQL */ `
  mutation DeleteTodo($id: UUID!) {
    deleteTodo(id: $id)
  }
`;

const CREATE_USER_TODO_SUBTASK = /* GraphQL */ `
  mutation CreateUserTodoSubtask($input: CreateUserTodoSubtaskInput!) {
    createUserTodoSubtask(input: $input) {
      id userTodoId title completed sortOrder createdAt updatedAt
    }
  }
`;

const UPDATE_USER_TODO_SUBTASK = /* GraphQL */ `
  mutation UpdateUserTodoSubtask($input: UpdateUserTodoSubtaskInput!) {
    updateUserTodoSubtask(input: $input) {
      id userTodoId title completed sortOrder createdAt updatedAt
    }
  }
`;

const DELETE_USER_TODO_SUBTASK = /* GraphQL */ `
  mutation DeleteUserTodoSubtask($id: UUID!) {
    deleteUserTodoSubtask(id: $id)
  }
`;

export const mfGoTodos = {
  myTodos: async () => {
    try {
      const r = await graphqlRequest<{ myTodos: UserTodoPayload[] }>(MY_TODOS_WITH_SUBTASKS);
      return r.myTodos;
    } catch (e) {
      if (!isSubtasksSchemaMismatchError(e)) throw e;
      const r = await graphqlRequest<{ myTodos: UserTodoPayload[] }>(MY_TODOS, {}, { silent: true });
      return r.myTodos;
    }
  },

  createTodo: async (input: {
    title: string;
    completed?: boolean;
    organizationID?: string | null;
    assignedToUserID?: string | null;
    dueAt?: string | null;
  }) => {
    const variables = {
      input: {
        title: input.title,
        completed: input.completed ?? false,
        organizationID: input.organizationID ?? undefined,
        assignedToUserID: input.assignedToUserID ?? undefined,
        dueAt: input.dueAt ?? undefined,
      },
    };
    try {
      const r = await graphqlRequest<{ createTodo: UserTodoPayload }>(CREATE_TODO, variables);
      return r.createTodo;
    } catch (e) {
      if (!isDueAtSchemaMismatchError(e)) throw e;
      const r = await graphqlRequest<{ createTodo: UserTodoPayload }>(
        CREATE_TODO_NO_DUE,
        {
          input: {
            title: input.title,
            completed: input.completed ?? false,
            organizationID: input.organizationID ?? undefined,
            assignedToUserID: input.assignedToUserID ?? undefined,
          },
        },
        { silent: true }
      );
      return {
        ...r.createTodo,
        ...(input.dueAt ? { _dueAtNotSaved: true as const } : {}),
      };
    }
  },

  updateTodo: async (input: {
    id: string;
    title?: string;
    completed?: boolean;
    organizationID?: string | null;
    clearOrganization?: boolean;
    assignedToUserID?: string | null;
    dueAt?: string | null;
    clearDueAt?: boolean;
  }) => {
    try {
      const r = await graphqlRequest<{ updateTodo: UserTodoPayload }>(UPDATE_TODO, { input });
      return r.updateTodo;
    } catch (e) {
      if (!isDueAtSchemaMismatchError(e)) throw e;
      const { dueAt: _da, clearDueAt: _cd, ...rest } = input;
      const r = await graphqlRequest<{ updateTodo: UserTodoPayload }>(
        UPDATE_TODO_NO_DUE,
        { input: rest },
        { silent: true }
      );
      const hadDueIntent = input.dueAt !== undefined || input.clearDueAt === true;
      return {
        ...r.updateTodo,
        ...(hadDueIntent ? { _dueAtNotSaved: true as const } : {}),
      };
    }
  },

  deleteTodo: (id: string) =>
    graphqlRequest<{ deleteTodo: boolean }>(DELETE_TODO, { id }).then(
      (r) => r.deleteTodo
    ),

  createUserTodoSubtask: (input: { userTodoId: string; title: string; completed?: boolean }) =>
    graphqlRequest<{ createUserTodoSubtask: UserTodoSubtaskPayload }>(CREATE_USER_TODO_SUBTASK, {
      input: {
        userTodoId: input.userTodoId,
        title: input.title,
        ...(input.completed !== undefined ? { completed: input.completed } : {}),
      },
    }).then((r) => r.createUserTodoSubtask),

  updateUserTodoSubtask: (input: {
    id: string;
    title?: string;
    completed?: boolean;
  }) => {
    const body: { id: string; title?: string; completed?: boolean } = { id: input.id };
    if (input.title !== undefined) body.title = input.title;
    if (input.completed !== undefined) body.completed = input.completed;
    return graphqlRequest<{ updateUserTodoSubtask: UserTodoSubtaskPayload }>(
      UPDATE_USER_TODO_SUBTASK,
      { input: body }
    ).then((r) => r.updateUserTodoSubtask);
  },

  deleteUserTodoSubtask: (id: string) =>
    graphqlRequest<{ deleteUserTodoSubtask: boolean }>(DELETE_USER_TODO_SUBTASK, { id }).then(
      (r) => r.deleteUserTodoSubtask
    ),
};

// ── Device ────────────────────────────────────────────────────────────────────

export const mfGoDevice = {
  registerDevice: (input: {
    deviceId: string;
    platform: string;
    deviceName?: string;
    model?: string;
    brand?: string;
    osName?: string;
    osVersion?: string;
    appName?: string;
    appVersion?: string;
    appBuild?: string;
  }) =>
    graphqlRequest<{ registerDevice: UserDevicePayload }>(REGISTER_DEVICE, {
      input,
    }).then((r) => r.registerDevice),

  myDevices: () =>
    graphqlRequest<{ myDevices: UserDevicePayload[] }>(MY_DEVICES).then(
      (r) => r.myDevices
    ),
};

// ── User messages (snackbar, real-time) ───────────────────────────────────────

export interface UserMessagePayload {
  id: string;
  userID: string;
  message: string;
  type: string;
  createdAt: string;
  readAt: string | null;
}

const MY_USER_MESSAGES = /* GraphQL */ `
  query MyUserMessages($limit: Int) {
    myUserMessages(limit: $limit) {
      id userID message type createdAt readAt
    }
  }
`;

const MARK_USER_MESSAGE_READ = /* GraphQL */ `
  mutation MarkUserMessageRead($id: UUID!) {
    markUserMessageRead(id: $id)
  }
`;

const ADMIN_CREATE_USER_MESSAGE = /* GraphQL */ `
  mutation AdminCreateUserMessage($input: CreateUserMessageInput!) {
    adminCreateUserMessage(input: $input) {
      id userID message type createdAt readAt
    }
  }
`;

const ADMIN_DELETE_USER_MESSAGE = /* GraphQL */ `
  mutation AdminDeleteUserMessage($id: UUID!) {
    adminDeleteUserMessage(id: $id)
  }
`;

export const USER_MESSAGE_CREATED_SUBSCRIPTION = /* GraphQL */ `
  subscription UserMessageCreated {
    userMessageCreated {
      id userID message type createdAt readAt
    }
  }
`;

export const mfGoUserMessages = {
  list: (limit?: number) =>
    graphqlRequest<{ myUserMessages: UserMessagePayload[] }>(MY_USER_MESSAGES, {
      limit: limit ?? 50,
    }).then((r) => r.myUserMessages),

  markRead: (id: string) =>
    graphqlRequest<{ markUserMessageRead: boolean }>(MARK_USER_MESSAGE_READ, {
      id,
    }).then((r) => r.markUserMessageRead),

  adminCreate: (input: { userID: string; message: string; type?: string }) =>
    graphqlRequest<{ adminCreateUserMessage: UserMessagePayload }>(
      ADMIN_CREATE_USER_MESSAGE,
      { input }
    ).then((r) => r.adminCreateUserMessage),

  adminDelete: (id: string) =>
    graphqlRequest<{ adminDeleteUserMessage: boolean }>(
      ADMIN_DELETE_USER_MESSAGE,
      { id }
    ).then((r) => r.adminDeleteUserMessage),
};

// ── Feedback (GFG-24) ─────────────────────────────────────────────────────────

export type FeedbackAuthorRole = 'USER' | 'ADMIN';

export interface FeedbackMessagePayload {
  id: string;
  threadID: string;
  authorRole: FeedbackAuthorRole;
  body: string;
  createdAt: string;
}

export interface FeedbackThreadPayload {
  id: string;
  userID: string | null;
  contactEmail: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages: FeedbackMessagePayload[];
}

export interface AdminFeedbackThreadPayload {
  thread: FeedbackThreadPayload;
  userEmail: string;
  userDisplayName: string;
}

const MY_FEEDBACK_THREADS = /* GraphQL */ `
  query MyFeedbackThreads {
    myFeedbackThreads {
      id
      userID
      contactEmail
      subject
      status
      createdAt
      updatedAt
      messages {
        id
        threadID
        authorRole
        body
        createdAt
      }
    }
  }
`;

const SUBMIT_FEEDBACK = /* GraphQL */ `
  mutation SubmitFeedback($input: SubmitFeedbackInput!) {
    submitFeedback(input: $input) {
      id
      userID
      contactEmail
      subject
      status
      createdAt
      updatedAt
      messages {
        id
        threadID
        authorRole
        body
        createdAt
      }
    }
  }
`;

const ADMIN_FEEDBACK_THREADS = /* GraphQL */ `
  query AdminFeedbackThreads($limit: Int) {
    adminFeedbackThreads(limit: $limit) {
      userEmail
      userDisplayName
      thread {
        id
        userID
        contactEmail
        subject
        status
        createdAt
        updatedAt
        messages {
          id
          threadID
          authorRole
          body
          createdAt
        }
      }
    }
  }
`;

const ADMIN_REPLY_TO_FEEDBACK = /* GraphQL */ `
  mutation AdminReplyToFeedback($input: AdminReplyToFeedbackInput!) {
    adminReplyToFeedback(input: $input) {
      id
      threadID
      authorRole
      body
      createdAt
    }
  }
`;

const ADMIN_DELETE_FEEDBACK_THREAD = /* GraphQL */ `
  mutation AdminDeleteFeedbackThread($threadID: UUID!) {
    adminDeleteFeedbackThread(threadID: $threadID)
  }
`;

export const mfGoFeedback = {
  myThreads: () =>
    graphqlRequest<{ myFeedbackThreads: FeedbackThreadPayload[] }>(
      MY_FEEDBACK_THREADS,
      {}
    ).then((r) => r.myFeedbackThreads),

  submit: (input: {
    subject?: string;
    message: string;
    /** Required when not signed in (server validates format). */
    contactEmail?: string;
  }) =>
    graphqlRequest<{ submitFeedback: FeedbackThreadPayload }>(SUBMIT_FEEDBACK, {
      input,
    }).then((r) => r.submitFeedback),
};

// ── Admin ────────────────────────────────────────────────────────────────────

const ADMIN_USERS = /* GraphQL */ `
  query AdminUsers($page: Int, $pageSize: Int) {
    adminUsers(page: $page, pageSize: $pageSize) {
      users { id email displayName nickname avatarURL bio status role createdAt updatedAt phoneNumber telegramChatId dateOfBirth gender location websiteURL socialTwitter socialGitHub socialLinkedIn language }
      totalCount page pageSize
    }
  }
`;

const ADMIN_USER = /* GraphQL */ `
  query AdminUser($id: UUID!) {
    adminUser(id: $id) {
      id email displayName nickname avatarURL bio status role createdAt updatedAt phoneNumber telegramChatId dateOfBirth gender location websiteURL socialTwitter socialGitHub socialLinkedIn language
    }
  }
`;

const ADMIN_SUSPEND_USER = /* GraphQL */ `
  mutation AdminSuspendUser($id: UUID!, $suspend: Boolean!) {
    adminSuspendUser(id: $id, suspend: $suspend) {
      id email displayName nickname avatarURL bio status role createdAt updatedAt
    }
  }
`;

const ADMIN_CHANGE_ROLE = /* GraphQL */ `
  mutation AdminChangeRole($id: UUID!, $role: UserRole!) {
    adminChangeRole(id: $id, role: $role) {
      id email displayName nickname avatarURL bio status role createdAt updatedAt
    }
  }
`;

const ADMIN_SET_USER_STATUS = /* GraphQL */ `
  mutation AdminSetUserStatus($id: UUID!, $status: UserStatus!) {
    adminSetUserStatus(id: $id, status: $status) {
      id email displayName nickname avatarURL bio status role createdAt updatedAt
    }
  }
`;

const ADMIN_APP_SETTINGS = /* GraphQL */ `
  query AdminAppSettings {
    adminAppSettings { key value description isPublic }
  }
`;

const ADMIN_USER_SESSIONS = /* GraphQL */ `
  query AdminUserSessions($userID: UUID, $limit: Int) {
    adminUserSessions(userID: $userID, limit: $limit) {
      id userID userEmail userDisplayName organizationNames deviceID platform deviceName createdAt lastRefreshedAt
    }
  }
`;

const ADMIN_SESSION_STATS = /* GraphQL */ `
  query AdminSessionStats {
    adminSessionStats {
      totalActiveSessions uniqueActiveUsers totalUsers totalRegisteredDevices
    }
  }
`;

const ADMIN_USER_DELETION_IMPACT = /* GraphQL */ `
  query AdminUserDeletionImpact($id: UUID!) {
    adminUserDeletionImpact(id: $id) {
      userID
      email
      displayName
      ownedTodoCount
      todoAssigneeClearCount
      organizationMembershipCount
      ownedOrganizations {
        organizationID
        name
        otherMemberCount
      }
      addressCount
      deviceCount
      hasUserSettings
      notificationReadCount
      sessionCount
      userMessageCount
      pendingInvitationAsInviterCount
    }
  }
`;

const ADMIN_USER_OWNED_TODOS = /* GraphQL */ `
  query AdminUserOwnedTodos($userID: UUID!) {
    adminUserOwnedTodos(userID: $userID) {
      id userID title completed organizationID assignedToUserID dueAt createdAt updatedAt
    }
  }
`;

const ADMIN_DELETE_USER_TODO = /* GraphQL */ `
  mutation AdminDeleteUserTodo($id: UUID!) {
    adminDeleteUserTodo(id: $id)
  }
`;

const ADMIN_UPDATE_USER_TODO = /* GraphQL */ `
  mutation AdminUpdateUserTodo($input: AdminUpdateUserTodoInput!) {
    adminUpdateUserTodo(input: $input) {
      id userID title completed organizationID assignedToUserID dueAt createdAt updatedAt
    }
  }
`;

const ADMIN_UPSERT_APP_SETTING = /* GraphQL */ `
  mutation AdminUpsertAppSetting($input: AdminAppSettingInput!) {
    adminUpsertAppSetting(input: $input) {
      key value description isPublic
    }
  }
`;

const ADMIN_MAIL_SMTP_SETTINGS = /* GraphQL */ `
  query AdminMailSmtpSettings {
    adminMailSmtpSettings {
      enabled
      host
      port
      username
      passwordConfigured
      fromAddress
      fromName
      subjectPrefix
      implicitTLS
      plainNoTLS
      updatedAt
    }
  }
`;

const ADMIN_UPDATE_MAIL_SMTP = /* GraphQL */ `
  mutation AdminUpdateMailSmtp($input: AdminUpdateMailSmtpSettingsInput!) {
    adminUpdateMailSmtpSettings(input: $input) {
      enabled
      host
      port
      username
      passwordConfigured
      fromAddress
      fromName
      subjectPrefix
      implicitTLS
      plainNoTLS
      updatedAt
    }
  }
`;

const ADMIN_SEND_TEST_MAIL = /* GraphQL */ `
  mutation AdminSendTestMail($input: AdminSendTestMailInput!) {
    adminSendTestMail(input: $input)
  }
`;

const ADMIN_SEND_USER_EMAIL = /* GraphQL */ `
  mutation AdminSendUserEmail($input: AdminSendUserEmailInput!) {
    adminSendUserEmail(input: $input)
  }
`;

const ADMIN_UPDATE_PRODUCT_RELEASE = /* GraphQL */ `
  mutation AdminUpdateProductRelease($input: AdminProductReleaseInput!) {
    adminUpdateProductRelease(input: $input) {
      version
      changelogMarkdown
      updatedAt
      updatedByDisplayName
    }
  }
`;

export const mfGoAdmin = {
  users: (page = 1, pageSize = 20) =>
    graphqlRequest<{ adminUsers: AdminUserList }>(ADMIN_USERS, {
      page,
      pageSize,
    }).then((r) => r.adminUsers),

  user: (id: string) =>
    graphqlRequest<{ adminUser: AdminUserProfile }>(ADMIN_USER, { id }).then(
      (r) => r.adminUser
    ),

  suspendUser: (id: string, suspend: boolean) =>
    graphqlRequest<{ adminSuspendUser: AdminUserProfile }>(
      ADMIN_SUSPEND_USER,
      { id, suspend }
    ).then((r) => r.adminSuspendUser),

  changeRole: (id: string, role: UserRole) =>
    graphqlRequest<{ adminChangeRole: AdminUserProfile }>(
      ADMIN_CHANGE_ROLE,
      { id, role }
    ).then((r) => r.adminChangeRole),

  setUserStatus: (id: string, status: UserStatus) =>
    graphqlRequest<{ adminSetUserStatus: AdminUserProfile }>(
      ADMIN_SET_USER_STATUS,
      { id, status }
    ).then((r) => r.adminSetUserStatus),

  deleteUser: (id: string) =>
    graphqlRequest<{ adminDeleteUser: boolean }>(
      /* GraphQL */ `
        mutation AdminDeleteUser($id: UUID!) {
          adminDeleteUser(id: $id)
        }
      `,
      { id }
    ).then((r) => r.adminDeleteUser),

  /** Admin-only: relational summary before permanent delete (matches DB FK cascades). */
  userDeletionImpact: (id: string) =>
    graphqlRequest<{ adminUserDeletionImpact: AdminUserDeletionImpact }>(
      ADMIN_USER_DELETION_IMPACT,
      { id }
    ).then((r) => r.adminUserDeletionImpact),

  /** Todos this user created (owner user_id). */
  userOwnedTodos: (userID: string) =>
    graphqlRequest<{ adminUserOwnedTodos: UserTodoPayload[] }>(
      ADMIN_USER_OWNED_TODOS,
      { userID }
    ).then((r) => r.adminUserOwnedTodos),

  deleteUserTodo: (id: string) =>
    graphqlRequest<{ adminDeleteUserTodo: boolean }>(ADMIN_DELETE_USER_TODO, {
      id,
    }).then((r) => r.adminDeleteUserTodo),

  updateUserTodo: (input: {
    id: string;
    title?: string;
    completed?: boolean;
    dueAt?: string | null;
    clearDueAt?: boolean;
  }) =>
    graphqlRequest<{ adminUpdateUserTodo: UserTodoPayload }>(
      ADMIN_UPDATE_USER_TODO,
      { input }
    ).then((r) => r.adminUpdateUserTodo),

  appSettings: () =>
    graphqlRequest<{ adminAppSettings: AdminAppSetting[] }>(
      ADMIN_APP_SETTINGS
    ).then((r) => r.adminAppSettings),

  userSessions: (userID?: string | null, limit?: number | null) =>
    graphqlRequest<{ adminUserSessions: UserSession[] }>(ADMIN_USER_SESSIONS, {
      userID: userID ?? null,
      limit: limit ?? null,
    }).then((r) => r.adminUserSessions),

  sessionStats: () =>
    graphqlRequest<{ adminSessionStats: AdminSessionStats }>(ADMIN_SESSION_STATS).then(
      (r) => r.adminSessionStats
    ),

  upsertAppSetting: (input: {
    key: string;
    value: string;
    description?: string;
    isPublic?: boolean;
  }) =>
    graphqlRequest<{ adminUpsertAppSetting: AdminAppSetting }>(
      ADMIN_UPSERT_APP_SETTING,
      { input }
    ).then((r) => r.adminUpsertAppSetting),

  mailSmtpSettings: () =>
    graphqlRequest<{ adminMailSmtpSettings: AdminMailSmtpSettings }>(
      ADMIN_MAIL_SMTP_SETTINGS
    ).then((r) => r.adminMailSmtpSettings),

  updateMailSmtpSettings: (input: AdminUpdateMailSmtpSettingsInput) => {
    const gqlInput: Record<string, unknown> = {
      enabled: input.enabled,
      host: input.host,
      port: input.port,
      username: input.username,
      fromAddress: input.fromAddress,
      fromName: input.fromName,
      subjectPrefix: input.subjectPrefix,
      implicitTLS: input.implicitTLS,
      plainNoTLS: input.plainNoTLS,
    };
    if (input.password !== undefined) {
      gqlInput.password = input.password;
    }
    return graphqlRequest<{ adminUpdateMailSmtpSettings: AdminMailSmtpSettings }>(
      ADMIN_UPDATE_MAIL_SMTP,
      { input: gqlInput }
    ).then((r) => r.adminUpdateMailSmtpSettings);
  },

  sendTestMail: (toEmail: string) =>
    graphqlRequest<{ adminSendTestMail: boolean }>(ADMIN_SEND_TEST_MAIL, {
      input: { toEmail },
    }).then((r) => r.adminSendTestMail),

  sendUserEmail: (userID: string, subject: string, body: string) =>
    graphqlRequest<{ adminSendUserEmail: boolean }>(ADMIN_SEND_USER_EMAIL, {
      input: { userID, subject, body },
    }).then((r) => r.adminSendUserEmail),

  updateProductRelease: (input: { version: string; changelogMarkdown: string }) =>
    graphqlRequest<{ adminUpdateProductRelease: ProductRelease }>(
      ADMIN_UPDATE_PRODUCT_RELEASE,
      { input }
    ).then((r) => r.adminUpdateProductRelease),

  feedbackThreads: (limit = 50) =>
    graphqlRequest<{ adminFeedbackThreads: AdminFeedbackThreadPayload[] }>(
      ADMIN_FEEDBACK_THREADS,
      { limit }
    ).then((r) => r.adminFeedbackThreads),

  replyToFeedback: (threadID: string, message: string) =>
    graphqlRequest<{ adminReplyToFeedback: FeedbackMessagePayload }>(
      ADMIN_REPLY_TO_FEEDBACK,
      { input: { threadID, message } }
    ).then((r) => r.adminReplyToFeedback),

  deleteFeedbackThread: (threadID: string) =>
    graphqlRequest<{ adminDeleteFeedbackThread: boolean }>(
      ADMIN_DELETE_FEEDBACK_THREAD,
      { threadID }
    ).then((r) => r.adminDeleteFeedbackThread),
};

// ── OTP ──────────────────────────────────────────────────────────────────────

export type OTPPurpose =
  | 'LOGIN'
  | 'VERIFY_IDENTITY'
  | 'PASSWORD_RESET'
  | 'ACCOUNT_ACTIVATE'
  | 'EMAIL_CHANGE';
export type OTPChannel = 'ADMIN_PANEL' | 'EMAIL' | 'SMS' | 'WHATSAPP' | 'TELEGRAM';
export type OTPStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED';

export interface OTPRequestPayload {
  otpID: string;
  channel: OTPChannel;
  expiresAt: string;
}

export interface OTPVerifyPayload {
  verified: boolean;
  otpID: string;
}

export interface AdminOTPEntry {
  id: string;
  userID: string;
  code: string;
  channel: OTPChannel;
  purpose: OTPPurpose;
  status: OTPStatus;
  attempts: number;
  maxRetries: number;
  expiresAt: string;
  verifiedAt: string | null;
  createdAt: string;
}

const REQUEST_OTP = /* GraphQL */ `
  mutation RequestOTP($input: RequestOTPInput!) {
    requestOTP(input: $input) {
      otpID
      channel
      expiresAt
    }
  }
`;

const VERIFY_OTP = /* GraphQL */ `
  mutation VerifyOTP($input: VerifyOTPInput!) {
    verifyOTP(input: $input) {
      verified
      otpID
    }
  }
`;

const ADMIN_REQUEST_OTP = /* GraphQL */ `
  mutation AdminRequestOTP($input: AdminRequestOTPInput!) {
    adminRequestOTP(input: $input) {
      otpID
      channel
      expiresAt
    }
  }
`;

const ADMIN_PENDING_OTPS = /* GraphQL */ `
  query AdminPendingOTPs($limit: Int, $offset: Int) {
    adminPendingOTPs(limit: $limit, offset: $offset) {
      id userID code channel purpose status
      attempts maxRetries expiresAt verifiedAt createdAt
    }
  }
`;

const ADMIN_USER_OTP_HISTORY = /* GraphQL */ `
  query AdminUserOTPHistory($userID: UUID!, $limit: Int, $offset: Int) {
    adminUserOTPHistory(userID: $userID, limit: $limit, offset: $offset) {
      id userID code channel purpose status
      attempts maxRetries expiresAt verifiedAt createdAt
    }
  }
`;

export const mfGoOTP = {
  request: (purpose: OTPPurpose) =>
    graphqlRequest<{ requestOTP: OTPRequestPayload }>(REQUEST_OTP, {
      input: { purpose },
    }).then((r) => r.requestOTP),

  verify: (code: string, purpose: OTPPurpose) =>
    graphqlRequest<{ verifyOTP: OTPVerifyPayload }>(VERIFY_OTP, {
      input: { code, purpose },
    }).then((r) => r.verifyOTP),
};

export const mfGoAdminOTP = {
  requestForUser: (userID: string, purpose: OTPPurpose) =>
    graphqlRequest<{ adminRequestOTP: OTPRequestPayload }>(ADMIN_REQUEST_OTP, {
      input: { userID, purpose },
    }).then((r) => r.adminRequestOTP),

  pendingOTPs: (limit = 50, offset = 0) =>
    graphqlRequest<{ adminPendingOTPs: AdminOTPEntry[] }>(ADMIN_PENDING_OTPS, {
      limit,
      offset,
    }).then((r) => r.adminPendingOTPs),

  userOTPHistory: (userID: string, limit = 50, offset = 0) =>
    graphqlRequest<{ adminUserOTPHistory: AdminOTPEntry[] }>(
      ADMIN_USER_OTP_HISTORY,
      { userID, limit, offset }
    ).then((r) => r.adminUserOTPHistory),
};

// ── Token sync (call when app-store auth changes) ────────────────────────────

export function syncMfGoAuthToken(token: string | null): void {
  if (token) {
    setGraphQLAuthToken(token);
  } else {
    clearGraphQLAuthToken();
  }
}
