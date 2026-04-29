/**
 * List organization projects; admins can create projects (GFG-92).
 */

import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import { t } from '@/src/shared/i18n';
import { mfGoOrganizations } from '@/src/shared/services/mf-go-api';
import type {
  OrganizationMemberPayload,
  OrganizationPayload,
  OrganizationProjectOrgInvitePendingRowPayload,
  OrganizationProjectPayload,
} from '@/src/shared/services/mf-go-api';
import { useAppStore } from '@/src/shared/store';
import { themedTextInputProps } from '@/src/shared/utils/themed-text-input';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { snackbarService } from '@/src/shared/services/snackbar-service';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowText: { flex: 1, fontSize: 16 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalBox: {
    marginHorizontal: 24,
    padding: 20,
    borderRadius: 14,
    gap: 12,
  },
  modalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8 },
});

export interface OrganizationProjectsScreenProps {
  organizationId: string;
}

export function OrganizationProjectsScreen({ organizationId }: OrganizationProjectsScreenProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const user = useAppStore((s) => s.user);
  const textInputTheme = themedTextInputProps(colors, isDark);

  const [organization, setOrganization] = useState<OrganizationPayload | null>(null);
  const [members, setMembers] = useState<OrganizationMemberPayload[]>([]);
  const [projects, setProjects] = useState<OrganizationProjectPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingInviteRows, setPendingInviteRows] = useState<OrganizationProjectOrgInvitePendingRowPayload[]>([]);
  const [pendingInvitesLoading, setPendingInvitesLoading] = useState(false);
  const [acceptingInviteProjectId, setAcceptingInviteProjectId] = useState<string | null>(null);
  const [rejectingInviteProjectId, setRejectingInviteProjectId] = useState<string | null>(null);

  const isAdminOrOwner =
    !!organization &&
    !!user &&
    (organization.ownerUserID === user.id ||
      members.some((m) => m.userID === user.id && (m.role === 'OWNER' || m.role === 'ADMIN')));
  const isOrgOwner = !!organization && !!user && organization.ownerUserID === user.id;

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!user) return;
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      try {
        let org: OrganizationPayload | null = null;
        try {
          org = await mfGoOrganizations.organization(organizationId);
        } catch {
          org = null;
        }
        setOrganization(org);

        let mems: OrganizationMemberPayload[] = [];
        try {
          mems = await mfGoOrganizations.organizationMembers(organizationId);
        } catch {
          mems = [];
        }
        setMembers(mems);

        let projs: OrganizationProjectPayload[] = [];
        try {
          projs = await mfGoOrganizations.organizationProjects(organizationId);
        } catch {
          projs = [];
        }
        setProjects(projs);

        if (org && user && org.ownerUserID === user.id) {
          setPendingInvitesLoading(true);
          try {
            const pending = await mfGoOrganizations.pendingOrganizationProjectOrgInvites(organizationId);
            setPendingInviteRows(pending);
          } catch {
            setPendingInviteRows([]);
          } finally {
            setPendingInvitesLoading(false);
          }
        } else {
          setPendingInviteRows([]);
          setPendingInvitesLoading(false);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [organizationId, user]
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const projectsScreenFocusSkipRef = useRef(true);
  useEffect(() => {
    projectsScreenFocusSkipRef.current = true;
  }, [organizationId]);
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      if (projectsScreenFocusSkipRef.current) {
        projectsScreenFocusSkipRef.current = false;
        return;
      }
      void load('refresh');
    }, [user, load])
  );

  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(`/organization/${organizationId}` as never);
  }, [organizationId]);

  const openProject = useCallback(
    (projectId: string) => {
      router.push(`/organization/${organizationId}/project/${projectId}` as never);
    },
    [organizationId]
  );

  const submitCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await mfGoOrganizations.createOrganizationProject({
        organizationId,
        name,
        description: newDesc.trim() || undefined,
      });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      await load('refresh');
    } finally {
      setSaving(false);
    }
  }, [organizationId, newName, newDesc, load]);

  const acceptPendingInvite = useCallback(
    async (projectId: string) => {
      setAcceptingInviteProjectId(projectId);
      try {
        await mfGoOrganizations.acceptOrganizationProjectOrgInvite(projectId, organizationId);
        snackbarService.success(t('profile.organizations.projects.acceptInviteSuccess'));
        await load('refresh');
      } catch {
        snackbarService.error(t('profile.organizations.projects.acceptInviteFailed'));
      } finally {
        setAcceptingInviteProjectId(null);
      }
    },
    [organizationId, load]
  );

  const rejectPendingInvite = useCallback(
    async (projectId: string) => {
      // #region agent log
      fetch('http://127.0.0.1:7659/ingest/2c0544e2-f318-40c6-96cc-b244c127100f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8a9b74'},body:JSON.stringify({sessionId:'8a9b74',runId:'initial',hypothesisId:'H5',location:'organization-projects-screen.tsx:rejectPendingInvite:start',message:'reject button action started',data:{organizationId,projectId},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setRejectingInviteProjectId(projectId);
      try {
        await mfGoOrganizations.declineOrganizationProjectOrgInvite(projectId, organizationId);
        snackbarService.success(t('profile.organizations.projects.rejectInviteSuccess'));
        await load('refresh');
      } catch {
        // #region agent log
        fetch('http://127.0.0.1:7659/ingest/2c0544e2-f318-40c6-96cc-b244c127100f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8a9b74'},body:JSON.stringify({sessionId:'8a9b74',runId:'initial',hypothesisId:'H5',location:'organization-projects-screen.tsx:rejectPendingInvite:catch',message:'reject button action failed',data:{organizationId,projectId},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        snackbarService.error(t('profile.organizations.projects.rejectInviteFailed'));
      } finally {
        setRejectingInviteProjectId(null);
      }
    },
    [organizationId, load]
  );

  const rowBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const sectionHeaderColor = isDark ? '#8E8E93' : '#6D6D72';

  const handleArchiveProject = useCallback(
    async (project: OrganizationProjectPayload) => {
      const snapshot = project;
      setProjects((prev) => prev.filter((x) => x.id !== project.id));
      try {
        await mfGoOrganizations.archiveOrganizationProject(project.id);
      } catch {
        setProjects((prev) => [snapshot, ...prev]);
        snackbarService.error(t('profile.organizations.projects.archiveFailed'));
        return;
      }
      snackbarService.show({
        message: t('profile.organizations.projects.archivedUndoHint'),
        type: 'info',
        duration: 5000,
        action: {
          label: t('common.undo'),
          onPress: () => {
            void (async () => {
              try {
                await mfGoOrganizations.unarchiveOrganizationProject(project.id);
                setProjects((prev) => [snapshot, ...prev]);
              } catch {
                snackbarService.error(t('profile.organizations.projects.undoArchiveFailed'));
              }
            })();
          },
        },
      });
    },
    []
  );

  if (!user) return null;

  return (
    <>
      <AppBarScaffold
        style={{ flex: 1 }}
        backgroundColor={colors.settingsBackground}
        appBar={
          <ScreenHeader
            title={t('profile.organizations.projects.title')}
            subtitle={organization?.name ?? ''}
            onBackPress={onBack}
            showBackButton
            variant="minimal"
            rightAction={
              isAdminOrOwner ? (
                <TouchableOpacity
                  onPress={() => setShowCreate(true)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.organizations.projects.createProject')}
                >
                  <Ionicons name="add-circle-outline" size={28} color={colors.tint} />
                </TouchableOpacity>
              ) : undefined
            }
          />
        }
      >
        {loading ? (
          <View style={{ paddingTop: 48, alignItems: 'center' }}>
            <ActivityIndicator color={colors.tint} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void load('refresh')}
                tintColor={colors.tint}
                colors={[colors.tint]}
              />
            }
          >
            <Text style={{ color: sectionHeaderColor, fontSize: 13, marginTop: 8, marginBottom: 8 }}>
              {t('profile.organizations.projects.sectionList').toUpperCase()}
            </Text>
            {isOrgOwner ? (
              <View
                style={{
                  marginBottom: 12,
                  borderRadius: 12,
                  overflow: 'hidden',
                  backgroundColor: rowBg,
                }}
              >
                <Text
                  style={{
                    color: sectionHeaderColor,
                    fontSize: 13,
                    marginHorizontal: 14,
                    marginTop: 12,
                    marginBottom: 8,
                  }}
                >
                  {t('profile.organizations.projects.pendingInvitesSection').toUpperCase()}
                </Text>
                {pendingInvitesLoading ? (
                  <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                    <ActivityIndicator color={colors.tint} />
                  </View>
                ) : pendingInviteRows.length === 0 ? (
                  <Text style={{ color: colors.labelText, paddingHorizontal: 14, paddingBottom: 12 }}>
                    {t('profile.organizations.projects.pendingInvitesEmpty')}
                  </Text>
                ) : (
                  pendingInviteRows.map((row, idx) => (
                    <View
                      key={`${row.projectId}-${row.hostOrganizationId}`}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderTopWidth: idx === 0 ? StyleSheet.hairlineWidth : 0,
                        borderBottomWidth:
                          idx < pendingInviteRows.length - 1 ? StyleSheet.hairlineWidth : 0,
                        borderColor: isDark ? '#38383A' : '#C6C6C8',
                        gap: 8,
                      }}
                    >
                      <Text style={{ color: colors.bodyText, fontSize: 15, fontWeight: '600' }}>
                        {row.projectName}
                      </Text>
                      <Text style={{ color: colors.labelText, fontSize: 13 }}>
                        {t('profile.organizations.projects.acceptInviteSubtitle', {
                          host: row.hostOrganizationName,
                          project: row.projectName,
                        })}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Pressable
                          onPress={() => void acceptPendingInvite(row.projectId)}
                          disabled={
                            acceptingInviteProjectId === row.projectId ||
                            rejectingInviteProjectId === row.projectId
                          }
                          style={({ pressed }) => ({
                            alignSelf: 'flex-start',
                            borderRadius: 9,
                            backgroundColor: colors.tint,
                            paddingVertical: 9,
                            paddingHorizontal: 12,
                            opacity:
                              acceptingInviteProjectId === row.projectId ||
                              rejectingInviteProjectId === row.projectId
                                ? 0.6
                                : pressed
                                  ? 0.85
                                  : 1,
                          })}
                        >
                          {acceptingInviteProjectId === row.projectId ? (
                            <ActivityIndicator size="small" color={onTint} />
                          ) : (
                            <Text style={{ color: onTint, fontWeight: '700', fontSize: 13 }}>
                              {t('profile.organizations.projects.acceptInviteButton')}
                            </Text>
                          )}
                        </Pressable>
                        <Pressable
                          onPress={() => void rejectPendingInvite(row.projectId)}
                          disabled={
                            acceptingInviteProjectId === row.projectId ||
                            rejectingInviteProjectId === row.projectId
                          }
                          style={({ pressed }) => ({
                            alignSelf: 'flex-start',
                            borderRadius: 9,
                            borderWidth: 1,
                            borderColor: '#FF3B30',
                            paddingVertical: 9,
                            paddingHorizontal: 12,
                            opacity:
                              acceptingInviteProjectId === row.projectId ||
                              rejectingInviteProjectId === row.projectId
                                ? 0.6
                                : pressed
                                  ? 0.85
                                  : 1,
                          })}
                        >
                          {rejectingInviteProjectId === row.projectId ? (
                            <ActivityIndicator size="small" color="#FF3B30" />
                          ) : (
                            <Text style={{ color: '#FF3B30', fontWeight: '700', fontSize: 13 }}>
                              {t('profile.organizations.projects.rejectInviteButton')}
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>
            ) : null}
            {projects.length === 0 ? (
              <View style={{ paddingVertical: 16 }}>
                <Text style={{ color: colors.labelText }}>
                  {!organization
                    ? t('profile.organizations.detail.notFound')
                    : isAdminOrOwner
                      ? t('profile.organizations.projects.empty')
                      : t('profile.organizations.projects.emptyMember')}
                </Text>
                {organization && isAdminOrOwner ? (
                  <Pressable
                    onPress={() => setShowCreate(true)}
                    style={({ pressed }) => ({
                      marginTop: 16,
                      alignSelf: 'flex-start',
                      paddingVertical: 12,
                      paddingHorizontal: 18,
                      borderRadius: 10,
                      backgroundColor: colors.tint,
                      opacity: pressed ? 0.85 : 1,
                    })}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.organizations.projects.createProject')}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                      {t('profile.organizations.projects.createProject')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: rowBg }}>
                {projects.map((p, i) => {
                  const isSharedProject = p.organizationId !== organizationId;
                  return (
                    <Swipeable
                      key={p.id}
                      friction={2}
                      rightThreshold={40}
                      renderRightActions={() =>
                        isAdminOrOwner ? (
                          <View
                            style={{
                              justifyContent: 'center',
                              alignItems: 'center',
                              width: 100,
                              marginLeft: 8,
                              borderRadius: 12,
                              backgroundColor: colors.warningColor ?? '#FF9500',
                            }}
                          >
                            <Ionicons name="archive-outline" size={20} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 4 }}>
                              {t('home.todos.archive')}
                            </Text>
                          </View>
                        ) : null
                      }
                      onSwipeableOpen={() => {
                        if (isAdminOrOwner) void handleArchiveProject(p);
                      }}
                    >
                      <Pressable
                        onPress={() => openProject(p.id)}
                        style={({ pressed }) => [
                          styles.row,
                          i < projects.length - 1 && {
                            borderBottomWidth: StyleSheet.hairlineWidth,
                            borderBottomColor: isDark ? '#38383A' : '#C6C6C8',
                          },
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <Ionicons name="folder-outline" size={22} color={colors.tint} />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Text style={[styles.rowText, { color: colors.bodyText }]}>{p.name}</Text>
                            {isSharedProject ? (
                              <View
                                style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: 6,
                                  backgroundColor: isDark ? '#3A3A3C' : '#E8E8ED',
                                }}
                              >
                                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.tint }}>
                                  {t('profile.organizations.projects.sharedProjectBadge')}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          {p.description?.trim() ? (
                            <Text
                              style={{ color: colors.labelText, fontSize: 13, marginTop: 2 }}
                              numberOfLines={2}
                            >
                              {p.description}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons name="chevron-forward" size={Sizing.icon.s} color={colors.icon} />
                      </Pressable>
                    </Swipeable>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
      </AppBarScaffold>

      {isAdminOrOwner ? (
        <Pressable
          onPress={() => setShowCreate(true)}
          style={[styles.fab, { backgroundColor: colors.tint }]}
          accessibilityRole="button"
          accessibilityLabel={t('profile.organizations.projects.createProject')}
        >
          <Ionicons name="add" size={28} color={onTint} />
        </Pressable>
      ) : null}

      <Modal visible={showCreate} transparent animationType="fade">
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
          }}
          onPress={() => !saving && setShowCreate(false)}
        >
          <Pressable style={[styles.modalBox, { backgroundColor: rowBg }]} onPress={(e) => e.stopPropagation()}>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.bodyText }}>
              {t('profile.organizations.projects.createProject')}
            </Text>
            <TextInput
              placeholder={t('profile.organizations.projects.namePlaceholder')}
              placeholderTextColor={textInputTheme.placeholderTextColor}
              value={newName}
              onChangeText={setNewName}
              style={[styles.modalInput, { borderColor: colors.surfaceBorder, color: colors.bodyText }]}
            />
            <TextInput
              placeholder={t('profile.organizations.projects.descriptionPlaceholder')}
              placeholderTextColor={textInputTheme.placeholderTextColor}
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
              style={[styles.modalInput, { borderColor: colors.surfaceBorder, color: colors.bodyText, minHeight: 72 }]}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => !saving && setShowCreate(false)} hitSlop={8}>
                <Text style={{ color: colors.tint }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable onPress={() => void submitCreate()} disabled={saving || !newName.trim()}>
                <Text style={{ color: colors.tint, fontWeight: '600', opacity: saving ? 0.5 : 1 }}>
                  {t('profile.organizations.projects.createAction')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
