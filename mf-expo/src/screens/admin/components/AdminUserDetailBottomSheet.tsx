/**
 * Full-height admin bottom sheet: user profile (adminUser) + owned todos with toggle/delete.
 * Styled like AppInfoBottomSheet / AdminDeleteUserBottomSheet.
 */

import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@/src/shared/hooks/use-locale';
import { t } from '@/src/shared/i18n';
import { mfGoAdmin } from '@/src/shared/services';
import type {
  AdminOTPEntry,
  AdminUserProfile,
  OTPPurpose,
  UserRole,
  UserTodoPayload,
} from '@/src/shared/services/mf-go-api';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { mfGoAdminOTP } from '@/src/shared/services/mf-go-api';
import { adminRoleLabel, adminStatusLabel } from '../utils/admin-user-labels';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';

function formatAdminTimestamp(iso: string | undefined, localeCode: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(localeCode === 'tr' ? 'tr-TR' : 'en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

interface AdminUserDetailBottomSheetProps {
  user: AdminUserProfile | null;
  onClose: () => void;
  /** Keep list row in sync after role refresh */
  onUserUpdated: (profile: AdminUserProfile) => void;
  currentAdminId: string | undefined;
}

function ProfileRow({
  label,
  value,
  colors,
  isLast,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof getThemeColors>;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.profileRow, isLast && styles.profileRowLast]}>
      <Text style={[styles.profileLabel, { color: colors.labelText }]}>{label}</Text>
      <Text style={[styles.profileValue, { color: colors.bodyText }]} numberOfLines={4}>
        {value || '—'}
      </Text>
    </View>
  );
}

export function AdminUserDetailBottomSheet({
  user,
  onClose,
  onUserUpdated,
  currentAdminId,
}: AdminUserDetailBottomSheetProps) {
  const { locale } = useLocale();
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const sheetMaxH = Math.round(
    Math.min(winH * Sizing.modal.sheetMaxHeightFraction, winH - Math.max(insets.top, 8))
  );
  /** Space reserved for sheet padding, handle, header row, footer buttons (scroll fills the rest). */
  const sheetChromeH =
    Sizing.padding.m +
    4 +
    Sizing.padding.l +
    Sizing.padding.l +
    88 +
    Sizing.padding.m +
    (Sizing.padding.m + 48) * 2 +
    Math.max(insets.bottom, Sizing.padding.l);
  const detailScrollMaxH = Math.max(200, sheetMaxH - sheetChromeH);

  const visible = user !== null;
  const userId = user?.id;

  const [profile, setProfile] = useState<AdminUserProfile | null>(null);
  const [todos, setTodos] = useState<UserTodoPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [roleBusy, setRoleBusy] = useState(false);
  const [todoBusyId, setTodoBusyId] = useState<string | null>(null);

  // OTP state
  const [otpHistory, setOtpHistory] = useState<AdminOTPEntry[]>([]);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpGenerated, setOtpGenerated] = useState<{ code: string; expiresAt: string } | null>(null);
  const [sessionResetBusy, setSessionResetBusy] = useState(false);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [p, td, otps] = await Promise.all([
        mfGoAdmin.user(userId),
        mfGoAdmin.userOwnedTodos(userId),
        mfGoAdminOTP.userOTPHistory(userId, 10).catch(() => [] as AdminOTPEntry[]),
      ]);
      setProfile(p);
      setTodos(td);
      setOtpHistory(otps);
      onUserUpdated(p);
    } catch (e) {
      setLoadError(getGraphQLErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [userId, onUserUpdated]);

  useEffect(() => {
    if (!visible || !userId) {
      setProfile(null);
      setTodos([]);
      setLoadError(null);
      setOtpHistory([]);
      setOtpGenerated(null);
      return;
    }
    void fetchData();
  }, [visible, userId, fetchData]);

  // Auto-poll OTP history every 5s so admin sees new codes in real-time
  useEffect(() => {
    if (!visible || !userId) return;
    const interval = setInterval(async () => {
      try {
        const otps = await mfGoAdminOTP.userOTPHistory(userId, 10);
        setOtpHistory(otps);
        // Show the latest pending OTP code automatically
        const pending = otps.find((o) => o.status === 'PENDING');
        if (pending) {
          setOtpGenerated({ code: pending.code, expiresAt: pending.expiresAt });
        }
      } catch {
        // silent — don't break polling on transient errors
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [visible, userId]);

  const display = profile ?? user;

  const handleRole = async (role: UserRole) => {
    if (!display || display.id === currentAdminId) return;
    setRoleBusy(true);
    try {
      const next = await mfGoAdmin.changeRole(display.id, role);
      setProfile(next);
      onUserUpdated(next);
    } catch (e) {
      setLoadError(getGraphQLErrorMessage(e));
    } finally {
      setRoleBusy(false);
    }
  };

  const toggleTodo = async (todo: UserTodoPayload) => {
    setTodoBusyId(todo.id);
    try {
      const updated = await mfGoAdmin.updateUserTodo({
        id: todo.id,
        completed: !todo.completed,
      });
      setTodos((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      setLoadError(getGraphQLErrorMessage(e));
    } finally {
      setTodoBusyId(null);
    }
  };

  const removeTodo = async (todo: UserTodoPayload) => {
    setTodoBusyId(todo.id);
    try {
      await mfGoAdmin.deleteUserTodo(todo.id);
      setTodos((prev) => prev.filter((x) => x.id !== todo.id));
    } catch (e) {
      setLoadError(getGraphQLErrorMessage(e));
    } finally {
      setTodoBusyId(null);
    }
  };

  const handleGenerateOTP = async (purpose: OTPPurpose = 'VERIFY_IDENTITY') => {
    if (!display) return;
    setOtpBusy(true);
    setOtpGenerated(null);
    try {
      const resp = await mfGoAdminOTP.requestForUser(display.id, purpose);
      // Fetch the pending OTPs to get the code (admin can see it)
      const pending = await mfGoAdminOTP.userOTPHistory(display.id, 10);
      setOtpHistory(pending);
      const match = pending.find((o) => o.id === resp.otpID);
      if (match) {
        setOtpGenerated({ code: match.code, expiresAt: match.expiresAt });
      }
    } catch (e) {
      setLoadError(getGraphQLErrorMessage(e));
    } finally {
      setOtpBusy(false);
    }
  };

  const handleSessionReset = async () => {
    if (!display) return;
    setSessionResetBusy(true);
    try {
      // Suspend then reactivate to force-revoke all sessions
      await mfGoAdmin.setUserStatus(display.id, 'SUSPENDED' as any);
      await mfGoAdmin.setUserStatus(display.id, 'ACTIVE' as any);
      // Generate a login OTP so user must re-auth with OTP
      await handleGenerateOTP('LOGIN');
      setLoadError(null);
    } catch (e) {
      setLoadError(getGraphQLErrorMessage(e));
    } finally {
      setSessionResetBusy(false);
    }
  };

  const cardStyle = {
    backgroundColor: colors.surfaceBackground,
    borderColor: colors.surfaceBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.2 : 0.06,
    shadowRadius: 8,
    elevation: 3,
  };

  const roles: UserRole[] = ['USER', 'MODERATOR', 'ADMIN'];
  const isSelf = display?.id === currentAdminId;
  const todosCompleted = todos.filter((x) => x.completed).length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.modalRoot} accessibilityRole="none">
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <AdaptiveKeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.sheet,
              {
                maxHeight: sheetMaxH,
                backgroundColor: colors.background,
                borderColor: colors.surfaceBorder,
                paddingBottom: Math.max(insets.bottom, Sizing.padding.l),
              },
            ]}
          >
            <View style={styles.handle} />
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.closeButton}
              accessibilityLabel={t('accessibility.closeModal')}
            >
              <Ionicons name="close" size={24} color={colors.bodyText} />
            </Pressable>

          <View style={styles.headerRow}>
            <View style={[styles.headerIcon, { backgroundColor: colors.tint + '22' }]}>
              <Ionicons name="person" size={26} color={colors.tint} />
            </View>
            <View style={styles.headerTextCol}>
              <Text
                style={[
                  styles.sheetTitle,
                  { color: colors.bodyText },
                  Platform.OS === 'android' ? { includeFontPadding: false } : null,
                ]}
              >
                {t('settings.adminUserManagement.detailSheetTitle')}
              </Text>
              {display ? (
                <Text style={[styles.sheetSubtitle, { color: colors.labelText }]} numberOfLines={2}>
                  {display.email}
                </Text>
              ) : null}
            </View>
          </View>

          {loading && !display ? (
            <View style={styles.centeredLoad}>
              <ActivityIndicator size="large" color={colors.tint} />
            </View>
          ) : (
            <ScrollView
              style={[styles.scroll, { height: detailScrollMaxH, maxHeight: detailScrollMaxH }]}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              bounces
              nestedScrollEnabled
            >
              {loadError ? (
                <Text style={styles.errorBanner}>{loadError}</Text>
              ) : null}

              {display ? (
                <>
                  <View style={[styles.card, cardStyle]}>
                    <View style={[styles.cardBadge, { backgroundColor: colors.tint }]}>
                      <Text style={[styles.cardBadgeText, { color: onTint }]}>
                        {t('settings.adminUserManagement.detailProfileBadge')}
                      </Text>
                    </View>
                    <View style={styles.cardBody}>
                      <ProfileRow
                        label={t('settings.adminUserManagement.detailFieldUserId')}
                        value={display.id}
                        colors={colors}
                      />
                      <ProfileRow
                        label={t('settings.adminUserManagement.detailFieldEmail')}
                        value={display.email}
                        colors={colors}
                      />
                      <ProfileRow
                        label={t('settings.adminUserManagement.detailFieldDisplayName')}
                        value={display.displayName}
                        colors={colors}
                      />
                      <ProfileRow
                        label={t('settings.adminUserManagement.detailFieldNickname')}
                        value={display.nickname}
                        colors={colors}
                      />
                      <ProfileRow
                        label={t('settings.adminUserManagement.detailFieldStatus')}
                        value={adminStatusLabel(display.status)}
                        colors={colors}
                      />
                      <ProfileRow
                        label={t('settings.adminUserManagement.detailFieldRole')}
                        value={adminRoleLabel(display.role)}
                        colors={colors}
                      />
                      <ProfileRow
                        label={t('settings.adminUserManagement.detailFieldLanguage')}
                        value={display.language}
                        colors={colors}
                      />
                      <ProfileRow
                        label={t('settings.adminUserManagement.detailFieldPhone')}
                        value={display.phoneNumber}
                        colors={colors}
                      />
                      <ProfileRow
                        label={t('settings.adminUserManagement.detailFieldBio')}
                        value={display.bio}
                        colors={colors}
                      />
                      <ProfileRow
                        label={t('settings.adminUserManagement.detailFieldCreated')}
                        value={formatAdminTimestamp(display.createdAt, locale)}
                        colors={colors}
                      />
                      <ProfileRow
                        label={t('settings.adminUserManagement.detailFieldUpdated')}
                        value={formatAdminTimestamp(display.updatedAt, locale)}
                        colors={colors}
                      />
                      <Text style={[styles.subsectionLabel, { color: colors.labelText }]}>
                        {t('settings.adminUserManagement.detailSectionContactSocial')}
                      </Text>
                      <ProfileRow
                        label={t('settings.adminUserManagement.detailFieldLocation')}
                        value={display.location}
                        colors={colors}
                      />
                      <ProfileRow
                        label={t('settings.adminUserManagement.detailFieldWebsite')}
                        value={display.websiteURL}
                        colors={colors}
                      />
                      <ProfileRow
                        label={t('settings.adminUserManagement.detailFieldAvatarUrl')}
                        value={display.avatarURL}
                        colors={colors}
                      />
                      <ProfileRow
                        label={t('settings.adminUserManagement.detailFieldDateOfBirth')}
                        value={display.dateOfBirth ? formatAdminTimestamp(display.dateOfBirth, locale) : ''}
                        colors={colors}
                      />
                      <ProfileRow
                        label={t('settings.adminUserManagement.detailFieldGender')}
                        value={display.gender}
                        colors={colors}
                      />
                      <ProfileRow
                        label={t('settings.adminUserManagement.detailFieldTwitter')}
                        value={display.socialTwitter}
                        colors={colors}
                      />
                      <ProfileRow
                        label={t('settings.adminUserManagement.detailFieldGitHub')}
                        value={display.socialGitHub}
                        colors={colors}
                      />
                      <ProfileRow
                        label={t('settings.adminUserManagement.detailFieldLinkedIn')}
                        value={display.socialLinkedIn}
                        colors={colors}
                        isLast
                      />
                    </View>
                  </View>

                  <Text style={[styles.sectionLabel, { color: colors.labelText }]}>
                    {t('settings.adminUserManagement.detailRoleSection')}
                  </Text>
                  <View style={styles.roleRow}>
                    {roles.map((role) => {
                      const active = display.role === role;
                      return (
                        <Pressable
                          key={role}
                          onPress={() => handleRole(role)}
                          disabled={roleBusy || isSelf}
                          style={[
                            styles.roleChip,
                            {
                              borderColor: active ? colors.tint : colors.surfaceBorder,
                              backgroundColor: active ? colors.tint + '28' : colors.surface,
                              opacity: isSelf ? 0.45 : 1,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: active ? colors.tint : colors.bodyText,
                              fontWeight: '600',
                              fontSize: 13,
                            }}
                          >
                            {adminRoleLabel(role)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {isSelf ? (
                    <Text style={[styles.hint, { color: colors.labelText }]}>
                      {t('settings.adminUserManagement.detailRoleSelfHint')}
                    </Text>
                  ) : null}

                  <View style={[styles.card, cardStyle, { marginTop: Sizing.padding.l }]}>
                    <View style={[styles.cardBadge, { backgroundColor: '#34C759' }]}>
                      <Text style={styles.cardBadgeTextOnGreen}>
                        {t('settings.adminUserManagement.detailTodosBadge')}
                      </Text>
                    </View>
                    <View style={styles.cardBody}>
                      {todos.length > 0 ? (
                        <Text style={[styles.todosSummary, { color: colors.labelText }]}>
                          {t('settings.adminUserManagement.detailTodosSummary', {
                            total: todos.length,
                            completed: todosCompleted,
                          })}
                        </Text>
                      ) : null}
                      {todos.length === 0 ? (
                        <Text style={[styles.emptyTodos, { color: colors.labelText }]}>
                          {t('settings.adminUserManagement.detailNoTodos')}
                        </Text>
                      ) : (
                        todos.map((todo, idx) => (
                          <View
                            key={todo.id}
                            style={[
                              styles.todoRow,
                              idx < todos.length - 1 && {
                                borderBottomWidth: StyleSheet.hairlineWidth,
                                borderBottomColor: colors.surfaceBorder,
                              },
                            ]}
                          >
                            <Pressable
                              onPress={() => toggleTodo(todo)}
                              disabled={todoBusyId === todo.id}
                              style={styles.todoCheck}
                              hitSlop={8}
                            >
                              {todoBusyId === todo.id ? (
                                <ActivityIndicator size="small" color={colors.tint} />
                              ) : (
                                <Ionicons
                                  name={todo.completed ? 'checkbox' : 'square-outline'}
                                  size={24}
                                  color={todo.completed ? '#34C759' : colors.labelText}
                                />
                              )}
                            </Pressable>
                            <View style={styles.todoTextCol}>
                              <Text
                                style={[
                                  styles.todoTitle,
                                  {
                                    color: colors.bodyText,
                                    textDecorationLine: todo.completed ? 'line-through' : 'none',
                                  },
                                ]}
                              >
                                {todo.title}
                              </Text>
                              <Text style={[styles.todoMeta, { color: colors.labelText }]}>
                                {[
                                  todo.organizationID
                                    ? `${t('settings.adminUserManagement.detailTodoOrg')}: ${todo.organizationID.slice(0, 8)}…`
                                    : null,
                                  `${t('settings.adminUserManagement.detailTodoCreated')}: ${formatAdminTimestamp(todo.createdAt, locale)}`,
                                  todo.assignedToUserID
                                    ? `${t('settings.adminUserManagement.detailTodoAssignee')}: ${todo.assignedToUserID.slice(0, 8)}…`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </Text>
                            </View>
                            <Pressable
                              onPress={() => removeTodo(todo)}
                              disabled={todoBusyId === todo.id}
                              style={styles.todoTrash}
                              hitSlop={8}
                            >
                              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                            </Pressable>
                          </View>
                        ))
                      )}
                    </View>
                  </View>

                  {/* ── OTP Section ─────────────────────────── */}
                  <View style={[styles.card, cardStyle, { marginTop: Sizing.padding.l }]}>
                    <View style={[styles.cardBadge, { backgroundColor: '#FF9500' }]}>
                      <Text style={[styles.cardBadgeTextOnGreen, { color: '#fff' }]}>
                        OTP Verification
                      </Text>
                    </View>
                    <View style={styles.cardBody}>
                      {/* Generate OTP button */}
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        <Pressable
                          onPress={() => handleGenerateOTP('VERIFY_IDENTITY')}
                          disabled={otpBusy || isSelf}
                          style={[
                            styles.roleChip,
                            {
                              borderColor: '#FF9500',
                              backgroundColor: '#FF950018',
                              opacity: otpBusy || isSelf ? 0.5 : 1,
                              flex: 1,
                              alignItems: 'center' as const,
                            },
                          ]}
                        >
                          {otpBusy ? (
                            <ActivityIndicator size="small" color="#FF9500" />
                          ) : (
                            <Text style={{ color: '#FF9500', fontWeight: '600', fontSize: 13 }}>
                              <Ionicons name="key-outline" size={14} color="#FF9500" /> Generate OTP
                            </Text>
                          )}
                        </Pressable>
                        <Pressable
                          onPress={handleSessionReset}
                          disabled={sessionResetBusy || isSelf}
                          style={[
                            styles.roleChip,
                            {
                              borderColor: '#FF3B30',
                              backgroundColor: '#FF3B3018',
                              opacity: sessionResetBusy || isSelf ? 0.5 : 1,
                              flex: 1,
                              alignItems: 'center' as const,
                            },
                          ]}
                        >
                          {sessionResetBusy ? (
                            <ActivityIndicator size="small" color="#FF3B30" />
                          ) : (
                            <Text style={{ color: '#FF3B30', fontWeight: '600', fontSize: 13 }}>
                              <Ionicons name="refresh-outline" size={14} color="#FF3B30" /> Reset Session
                            </Text>
                          )}
                        </Pressable>
                      </View>

                      {isSelf ? (
                        <Text style={[styles.hint, { color: colors.labelText }]}>
                          Cannot generate OTP for yourself
                        </Text>
                      ) : null}

                      {/* Active OTP code display */}
                      {otpGenerated ? (
                        <View
                          style={{
                            backgroundColor: '#FF950015',
                            borderRadius: 12,
                            padding: 16,
                            marginBottom: 12,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ color: colors.labelText, fontSize: 12, marginBottom: 4 }}>
                            Active OTP Code
                          </Text>
                          <Text
                            style={{
                              fontSize: 32,
                              fontWeight: '800',
                              letterSpacing: 8,
                              color: '#FF9500',
                              fontVariant: ['tabular-nums'],
                            }}
                            selectable
                          >
                            {otpGenerated.code}
                          </Text>
                          <Text style={{ color: colors.labelText, fontSize: 11, marginTop: 4 }}>
                            Expires: {formatAdminTimestamp(otpGenerated.expiresAt, locale)}
                          </Text>
                        </View>
                      ) : null}

                      {/* OTP history */}
                      {otpHistory.length > 0 ? (
                        <>
                          <Text
                            style={[styles.subsectionLabel, { color: colors.labelText, marginTop: 4 }]}
                          >
                            Recent OTP History
                          </Text>
                          {otpHistory.slice(0, 5).map((otp, idx) => (
                            <View
                              key={otp.id}
                              style={[
                                styles.todoRow,
                                idx < Math.min(otpHistory.length, 5) - 1 && {
                                  borderBottomWidth: StyleSheet.hairlineWidth,
                                  borderBottomColor: colors.surfaceBorder,
                                },
                              ]}
                            >
                              <Ionicons
                                name={
                                  otp.status === 'VERIFIED'
                                    ? 'checkmark-circle'
                                    : otp.status === 'EXPIRED'
                                      ? 'time-outline'
                                      : 'ellipse-outline'
                                }
                                size={20}
                                color={
                                  otp.status === 'VERIFIED'
                                    ? '#34C759'
                                    : otp.status === 'EXPIRED'
                                      ? '#8E8E93'
                                      : '#FF9500'
                                }
                              />
                              <View style={styles.todoTextCol}>
                                <Text style={[styles.todoTitle, { color: colors.bodyText }]}>
                                  {otp.code} — {otp.purpose.replace('_', ' ')}
                                </Text>
                                <Text style={[styles.todoMeta, { color: colors.labelText }]}>
                                  {otp.status} · {otp.channel.replace('_', ' ')} · Attempts: {otp.attempts}/{otp.maxRetries} · {formatAdminTimestamp(otp.createdAt, locale)}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </>
                      ) : (
                        <Text style={[styles.emptyTodos, { color: colors.labelText }]}>
                          No OTP history for this user
                        </Text>
                      )}
                    </View>
                  </View>
                </>
              ) : null}
            </ScrollView>
          )}

          <View style={styles.footerActions}>
            <Pressable
              onPress={() => void fetchData()}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { borderColor: colors.surfaceBorder, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.tint }]}>
                {t('settings.adminUserManagement.detailRefresh')}
              </Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.tint, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Text style={[styles.primaryBtnText, { color: onTint }]}>
                {t('common.close')}
              </Text>
            </Pressable>
          </View>
          </View>
        </AdaptiveKeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    ...(Platform.OS === 'android' && { elevation: 999 }),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  keyboardView: {
    width: '100%',
    maxHeight: '100%',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    alignSelf: 'flex-end',
    overflow: 'hidden',
    borderTopLeftRadius: Sizing.modal.sheetTopCornerRadius,
    borderTopRightRadius: Sizing.modal.sheetTopCornerRadius,
    borderBottomLeftRadius: Sizing.modal.sheetBottomCornerRadius,
    borderBottomRightRadius: Sizing.modal.sheetBottomCornerRadius,
    paddingHorizontal: Sizing.padding.xl,
    paddingTop: Sizing.padding.m,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    ...(Platform.OS === 'android' && { elevation: 1000 }),
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.4)',
    alignSelf: 'center',
    marginBottom: Sizing.padding.l,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: Sizing.padding.l,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: { flex: 1, minWidth: 0 },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 28,
    paddingTop: Platform.OS === 'android' ? 2 : 0,
  },
  sheetSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  centeredLoad: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 180,
    paddingVertical: Sizing.padding.xl,
  },
  scroll: {
    width: '100%',
  },
  scrollContent: {
    paddingTop: Sizing.padding.s,
    paddingBottom: Sizing.padding.l,
  },
  errorBanner: {
    color: '#FF3B30',
    marginBottom: Sizing.padding.m,
    fontSize: 14,
  },
  card: {
    padding: Sizing.padding.l,
    paddingTop: Sizing.padding.l + 10,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'visible',
  },
  cardBadge: {
    position: 'absolute',
    top: -8,
    left: 12,
    zIndex: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardBadgeText: { fontWeight: '600', fontSize: 11 },
  cardBadgeTextOnGreen: { color: '#FFFFFF', fontWeight: '600', fontSize: 11 },
  cardBody: {
    paddingTop: Sizing.padding.s,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  subsectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: Sizing.padding.m,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  todosSummary: {
    fontSize: 13,
    marginBottom: Sizing.padding.s,
    lineHeight: 18,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.12)',
  },
  profileRowLast: { borderBottomWidth: 0 },
  profileLabel: { fontSize: 13, flex: 0.4 },
  profileValue: { fontSize: 13, flex: 0.6, textAlign: 'right' },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: Sizing.padding.m,
    marginBottom: 8,
  },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  hint: { fontSize: 12, marginTop: 8 },
  emptyTodos: { fontSize: 14, paddingVertical: 12 },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  todoCheck: { width: 36, alignItems: 'center' },
  todoTextCol: { flex: 1, minWidth: 0 },
  todoTitle: { fontSize: 15, fontWeight: '500' },
  todoMeta: { fontSize: 11, marginTop: 4 },
  todoTrash: { padding: 4 },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Sizing.padding.m,
    flexShrink: 0,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: Sizing.padding.m,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '600' },
  primaryBtn: {
    flex: 1,
    paddingVertical: Sizing.padding.m,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '600' },
});
