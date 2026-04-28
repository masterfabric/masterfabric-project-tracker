/**
 * Project roster + todos / purchases tabs (GFG-92, GFG-112 shell).
 */

import {
  MessageBottomSheet,
  okSheetAction,
  type MessageSheetAction,
} from '@/src/shared/components/MessageBottomSheet';
import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import { t } from '@/src/shared/i18n';
import { useLocale } from '@/src/shared/hooks/use-locale';
import { OrganizationProjectPurchaseSheet } from './organization-project-purchase-sheet';
import { mfGoOrganizations } from '@/src/shared/services/mf-go-api';
import type {
  OrganizationMemberPayload,
  OrganizationPayload,
  OrganizationProjectMemberPayload,
  OrganizationProjectOrgInvitePendingRowPayload,
  OrganizationProjectPayload,
  OrganizationProjectPurchasePayload,
  OrganizationProjectTodoPayload,
  OrganizationProjectTodoSubtaskPayload,
} from '@/src/shared/services/mf-go-api';
import { useAppStore } from '@/src/shared/store';
import { splitLeadingTodoEmoji } from '@/src/screens/home/constants/todo-emojis';
import {
  TodoSheet,
  type TodoSheetSaveInput,
} from '@/src/screens/home/components/todo-sheet';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { snackbarService } from '@/src/shared/services/snackbar-service';
import {
  cancelTodoReminder,
  projectTodoToReminderPayload,
  syncTodoRemindersFromList,
} from '@/src/shared/services/todo-reminders-service';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const styles = StyleSheet.create({
  section: { fontSize: 13, marginTop: 20, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  filterRow: {
    flexDirection: 'row',
    gap: Sizing.gap.m,
    marginTop: 10,
    marginBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  detailTabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginTop: 20,
  },
  detailTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalPickRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

function parseAssigneeQueryParam(
  raw: string | string[] | undefined
): 'all' | 'unassigned' | 'me' | string | undefined {
  const v = typeof raw === 'string' ? raw : raw?.[0];
  if (v == null || typeof v !== 'string') return undefined;
  try {
    const decoded = decodeURIComponent(v.trim());
    if (decoded === 'all' || decoded === 'unassigned' || decoded === 'me') return decoded;
    return decoded.length > 0 ? decoded : undefined;
  } catch {
    return undefined;
  }
}

export interface OrganizationProjectDetailScreenProps {
  organizationId: string;
  projectId: string;
  /** From home (or deep link): `?assignee=all|unassigned|me|<userId>` */
  initialAssigneeFilterParam?: string | string[];
}

export function OrganizationProjectDetailScreen({
  organizationId,
  projectId,
  initialAssigneeFilterParam,
}: OrganizationProjectDetailScreenProps) {
  const { locale } = useLocale();
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const user = useAppStore((s) => s.user);
  const onTint = foregroundOnTint(isDark);

  const [organization, setOrganization] = useState<OrganizationPayload | null>(null);
  const [orgMembers, setOrgMembers] = useState<OrganizationMemberPayload[]>([]);
  const [project, setProject] = useState<OrganizationProjectPayload | null>(null);
  const [projMembers, setProjMembers] = useState<OrganizationProjectMemberPayload[]>([]);
  const [todos, setTodos] = useState<OrganizationProjectTodoPayload[]>([]);
  const [purchases, setPurchases] = useState<OrganizationProjectPurchasePayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTodoSheet, setShowTodoSheet] = useState(false);
  const [showPurchaseSheet, setShowPurchaseSheet] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<OrganizationProjectPurchasePayload | null>(
    null
  );
  const [assigneeFilter, setAssigneeFilter] = useState<
    'all' | 'unassigned' | 'me' | string
  >('all');
  const [showAddMember, setShowAddMember] = useState(false);
  const [detailTab, setDetailTab] = useState<'todos' | 'purchases'>('todos');
  const [msgSheet, setMsgSheet] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'success' | 'error';
    primaryAction: MessageSheetAction;
    secondaryAction?: MessageSheetAction;
  } | null>(null);
  const [projectSubtaskDrafts, setProjectSubtaskDrafts] = useState<Record<string, string>>({});
  const [projectSubtasksBusy, setProjectSubtasksBusy] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [inviteParticipantOrgId, setInviteParticipantOrgId] = useState('');
  const [inviteOrgCandidates, setInviteOrgCandidates] = useState<OrganizationPayload[]>([]);
  const [inviteOrgCandidatesLoading, setInviteOrgCandidatesLoading] = useState(false);
  const [showInviteOrgPicker, setShowInviteOrgPicker] = useState(false);
  /** Stored as JSON keys `todos` and `purchases` on mf-go participation capabilities. */
  const [inviteCapTodos, setInviteCapTodos] = useState(true);
  const [inviteCapPurchases, setInviteCapPurchases] = useState(true);
  const [inviteFlowBusy, setInviteFlowBusy] = useState(false);
  const [pendingInviteRows, setPendingInviteRows] = useState<OrganizationProjectOrgInvitePendingRowPayload[]>([]);
  const [pendingInvitesLoading, setPendingInvitesLoading] = useState(false);

  const isAdminOrOwner =
    !!organization &&
    !!user &&
    (organization.ownerUserID === user.id ||
      orgMembers.some((m) => m.userID === user.id && (m.role === 'OWNER' || m.role === 'ADMIN')));

  const projectUserIds = useMemo(() => new Set(projMembers.map((m) => m.userId)), [projMembers]);

  const isHostProjectContext = !!project && project.organizationId === organizationId;
  const isParticipantOrgOwner =
    !!organization && !!user && organization.ownerUserID === user.id;
  const showProjectSettingsGear =
    (isHostProjectContext && isAdminOrOwner) || (!isHostProjectContext && isParticipantOrgOwner);

  const pendingInviteForThisProject = useMemo(
    () => pendingInviteRows.find((r) => r.projectId === projectId),
    [pendingInviteRows, projectId]
  );

  const projectMemberNickByUserId = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of projMembers) {
      m.set(x.userId, x.userNickname?.trim() || `${x.userId.slice(0, 8)}…`);
    }
    return m;
  }, [projMembers]);

  const candidatesToAdd = useMemo(
    () =>
      orgMembers.filter((m) => m.membershipStatus === 'ACTIVE' && !projectUserIds.has(m.userID)),
    [orgMembers, projectUserIds]
  );

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!user) return;
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      try {
        const [org, om, p, pm, td] = await Promise.all([
          mfGoOrganizations.organization(organizationId),
          mfGoOrganizations.organizationMembers(organizationId),
          mfGoOrganizations.organizationProject(projectId),
          mfGoOrganizations.organizationProjectMembers(projectId),
          mfGoOrganizations.organizationProjectTodos(projectId),
        ]);
        setOrganization(org);
        setOrgMembers(om);
        setProject(p);
        setProjMembers(pm);
        setTodos(td);
        let pu: OrganizationProjectPurchasePayload[] = [];
        try {
          pu = await mfGoOrganizations.organizationProjectPurchases(projectId);
        } catch {
          pu = [];
        }
        setPurchases(pu);
      } catch {
        setProject(null);
        setProjMembers([]);
        setTodos([]);
        setPurchases([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [organizationId, projectId, user]
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  useEffect(() => {
    const parsed = parseAssigneeQueryParam(initialAssigneeFilterParam);
    if (parsed !== undefined) {
      setAssigneeFilter(parsed);
    }
  }, [organizationId, projectId, initialAssigneeFilterParam]);

  useEffect(() => {
    setShowPurchaseSheet(false);
    setEditingPurchase(null);
  }, [organizationId, projectId]);

  useEffect(() => {
    if (todos.length === 0) return;
    void syncTodoRemindersFromList(todos.map(projectTodoToReminderPayload));
  }, [todos]);

  const projectScreenFocusSkipRef = useRef(true);
  const purchaseSheetModeRef = useRef<'create' | 'edit'>('create');
  useEffect(() => {
    projectScreenFocusSkipRef.current = true;
  }, [organizationId, projectId]);
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      if (projectScreenFocusSkipRef.current) {
        projectScreenFocusSkipRef.current = false;
        return;
      }
      void load('refresh');
    }, [user, load])
  );

  const filteredTodos = useMemo(() => {
    if (assigneeFilter === 'all') return todos;
    if (assigneeFilter === 'unassigned') {
      return todos.filter((x) => !x.assignedToUserId);
    }
    if (assigneeFilter === 'me' && user) {
      return todos.filter((x) => x.assignedToUserId === user.id);
    }
    return todos.filter((x) => x.assignedToUserId === assigneeFilter);
  }, [todos, assigneeFilter, user]);

  const projMembersForAssigneeChips = useMemo(() => {
    if (!user?.id) return projMembers;
    return projMembers.filter((m) => m.userId !== user.id);
  }, [projMembers, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (assigneeFilter === user.id) {
      setAssigneeFilter('me');
    }
  }, [user?.id, assigneeFilter, user]);

  const fetchOrgMembersForSheet = useCallback(
    async (orgId: string): Promise<OrganizationMemberPayload[]> => {
      if (orgId !== organizationId) return [];
      return orgMembers;
    },
    [organizationId, orgMembers]
  );

  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(`/organization/${organizationId}/projects` as never);
  }, [organizationId]);

  const showErr = useCallback((message: string) => {
    setMsgSheet({
      title: t('common.error'),
      message,
      variant: 'error',
      primaryAction: okSheetAction(() => setMsgSheet(null)),
    });
  }, []);

  const loadPendingInvites = useCallback(async () => {
    if (!user || !organization || organization.ownerUserID !== user.id) return;
    setPendingInvitesLoading(true);
    try {
      const rows = await mfGoOrganizations.pendingOrganizationProjectOrgInvites(organizationId);
      setPendingInviteRows(rows);
    } catch {
      setPendingInviteRows([]);
      showErr(t('profile.organizations.projects.pendingInvitesLoadFailed'));
    } finally {
      setPendingInvitesLoading(false);
    }
  }, [user, organization, organizationId, showErr]);

  const submitOrgProjectInvite = useCallback(async () => {
    const trimmed = inviteParticipantOrgId.trim();
    if (!trimmed) return;
    setInviteFlowBusy(true);
    try {
      const capabilitiesJson = JSON.stringify({
        todos: inviteCapTodos,
        purchases: inviteCapPurchases,
      });
      await mfGoOrganizations.createOrganizationProjectOrgInvite({
        projectId,
        participantOrganizationId: trimmed,
        capabilitiesJson,
      });
      snackbarService.success(t('profile.organizations.projects.inviteSent'));
      setInviteParticipantOrgId('');
      setInviteCapTodos(true);
      setInviteCapPurchases(true);
      setShowInviteOrgPicker(false);
      setShowProjectSettings(false);
      await load('refresh');
    } catch {
      showErr(t('profile.organizations.projects.inviteFailed'));
    } finally {
      setInviteFlowBusy(false);
    }
  }, [
    inviteParticipantOrgId,
    inviteCapTodos,
    inviteCapPurchases,
    projectId,
    load,
    showErr,
    t,
  ]);

  const loadInviteOrgCandidates = useCallback(async () => {
    if (!isHostProjectContext || !isAdminOrOwner) return;
    setInviteOrgCandidatesLoading(true);
    try {
      const rows = await mfGoOrganizations.myOrganizations();
      setInviteOrgCandidates(rows.filter((x) => x.id !== organizationId));
    } catch {
      setInviteOrgCandidates([]);
      showErr(t('profile.organizations.projects.inviteOrgCandidatesLoadFailed'));
    } finally {
      setInviteOrgCandidatesLoading(false);
    }
  }, [isAdminOrOwner, isHostProjectContext, organizationId, showErr, t]);

  const selectedInviteOrgName = useMemo(() => {
    if (!inviteParticipantOrgId.trim()) return null;
    const found = inviteOrgCandidates.find((x) => x.id === inviteParticipantOrgId.trim());
    return found?.name ?? null;
  }, [inviteOrgCandidates, inviteParticipantOrgId]);

  const acceptOrgProjectInvite = useCallback(async () => {
    setInviteFlowBusy(true);
    try {
      await mfGoOrganizations.acceptOrganizationProjectOrgInvite(projectId, organizationId);
      snackbarService.success(t('profile.organizations.projects.acceptInviteSuccess'));
      setShowProjectSettings(false);
      setPendingInviteRows((rows) => rows.filter((r) => r.projectId !== projectId));
      await load('refresh');
    } catch {
      showErr(t('profile.organizations.projects.acceptInviteFailed'));
    } finally {
      setInviteFlowBusy(false);
    }
  }, [organizationId, projectId, load, showErr, t]);

  const saveTodoFromSheet = useCallback(
    async (input: TodoSheetSaveInput) => {
      try {
        const created = await mfGoOrganizations.createOrganizationProjectTodo({
          projectId,
          title: input.title,
          assignedToUserId: input.assignedToUserID ?? undefined,
          dueAt: input.dueAt ?? undefined,
        });
        await load('refresh');
        snackbarService.success(t('home.todos.addedToProjectList'), 2800);
        if (created._dueAtNotSaved) {
          snackbarService.info(t('home.todos.dueAtNotSavedOnServer'), 4200);
        }
        return null;
      } catch {
        return t('profile.organizations.projects.todoAddFailed');
      }
    },
    [projectId, load, t]
  );

  const toggleTodo = useCallback(
    async (item: OrganizationProjectTodoPayload) => {
      const next = item.status === 'DONE' ? 'OPEN' : 'DONE';
      try {
        const updated = await mfGoOrganizations.updateOrganizationProjectTodo({
          todoId: item.id,
          status: next,
        });
        setTodos((prev) =>
          prev.map((x) =>
            x.id === updated.id
              ? { ...updated, subtasks: Array.isArray(x.subtasks) ? x.subtasks : updated.subtasks }
              : x
          )
        );
      } catch {
        showErr(t('profile.organizations.projects.todoUpdateFailed'));
      }
    },
    [showErr]
  );

  const toggleProjectSubtask = useCallback(
    async (parent: OrganizationProjectTodoPayload, sub: OrganizationProjectTodoSubtaskPayload) => {
      if (!Array.isArray(parent.subtasks)) return;
      setProjectSubtasksBusy(true);
      try {
        const updated = await mfGoOrganizations.updateOrganizationProjectTodoSubtask({
          id: sub.id,
          completed: !sub.completed,
        });
        setTodos((prev) =>
          prev.map((x) =>
            x.id === parent.id
              ? {
                  ...x,
                  subtasks: (x.subtasks ?? []).map((s) => (s.id === updated.id ? updated : s)),
                }
              : x
          )
        );
      } catch {
        showErr(t('home.todos.subtaskSaveFailed'));
      } finally {
        setProjectSubtasksBusy(false);
      }
    },
    [showErr, t]
  );

  const deleteProjectSubtask = useCallback(
    async (parent: OrganizationProjectTodoPayload, subId: string) => {
      if (!Array.isArray(parent.subtasks)) return;
      setProjectSubtasksBusy(true);
      try {
        await mfGoOrganizations.deleteOrganizationProjectTodoSubtask(subId);
        setTodos((prev) =>
          prev.map((x) =>
            x.id === parent.id
              ? { ...x, subtasks: (x.subtasks ?? []).filter((s) => s.id !== subId) }
              : x
          )
        );
      } catch {
        showErr(t('home.todos.subtaskSaveFailed'));
      } finally {
        setProjectSubtasksBusy(false);
      }
    },
    [showErr, t]
  );

  const addProjectSubtask = useCallback(
    async (parent: OrganizationProjectTodoPayload) => {
      if (!Array.isArray(parent.subtasks)) return;
      const title = (projectSubtaskDrafts[parent.id] ?? '').trim();
      if (!title) return;
      setProjectSubtasksBusy(true);
      try {
        const created = await mfGoOrganizations.createOrganizationProjectTodoSubtask({
          projectTodoId: parent.id,
          title,
        });
        setProjectSubtaskDrafts((d) => ({ ...d, [parent.id]: '' }));
        setTodos((prev) =>
          prev.map((x) =>
            x.id === parent.id
              ? { ...x, subtasks: [...(x.subtasks ?? []), created] }
              : x
          )
        );
      } catch {
        showErr(t('home.todos.subtaskSaveFailed'));
      } finally {
        setProjectSubtasksBusy(false);
      }
    },
    [projectSubtaskDrafts, showErr, t]
  );

  const confirmDeleteTodo = useCallback(
    (item: OrganizationProjectTodoPayload) => {
      setMsgSheet({
        title: t('common.delete'),
        message: t('profile.organizations.projects.deleteTodoConfirm'),
        variant: 'info',
        secondaryAction: {
          label: t('common.cancel'),
          onPress: () => setMsgSheet(null),
        },
        primaryAction: {
          label: t('common.delete'),
          destructive: true,
          onPress: () => {
            setMsgSheet(null);
            void (async () => {
              try {
                await cancelTodoReminder(item.id);
                await mfGoOrganizations.deleteOrganizationProjectTodo(item.id);
                setTodos((prev) => prev.filter((x) => x.id !== item.id));
              } catch {
                showErr(t('profile.organizations.projects.todoDeleteFailed'));
              }
            })();
          },
        },
      });
    },
    [showErr]
  );

  const addMember = useCallback(
    async (userId: string) => {
      try {
        await mfGoOrganizations.addOrganizationProjectMember(projectId, userId);
        setShowAddMember(false);
        await load('refresh');
      } catch {
        showErr(t('profile.organizations.projects.memberAddFailed'));
      }
    },
    [projectId, load, showErr]
  );

  const removeMember = useCallback(
    (userId: string, label: string) => {
      setMsgSheet({
        title: t('profile.organizations.projects.removeMember'),
        message: t('profile.organizations.projects.removeMemberConfirm', { name: label }),
        variant: 'info',
        secondaryAction: {
          label: t('common.cancel'),
          onPress: () => setMsgSheet(null),
        },
        primaryAction: {
          label: t('profile.organizations.projects.removeMember'),
          destructive: true,
          onPress: () => {
            setMsgSheet(null);
            void (async () => {
              try {
                await mfGoOrganizations.removeOrganizationProjectMember(projectId, userId);
                await load('refresh');
              } catch {
                showErr(t('profile.organizations.projects.memberRemoveFailed'));
              }
            })();
          },
        },
      });
    },
    [projectId, load, showErr]
  );

  const confirmDeletePurchase = useCallback(
    (item: OrganizationProjectPurchasePayload) => {
      setMsgSheet({
        title: t('common.delete'),
        message: t('profile.organizations.projects.deletePurchaseConfirm', {
          name: item.productName,
        }),
        variant: 'info',
        secondaryAction: {
          label: t('common.cancel'),
          onPress: () => setMsgSheet(null),
        },
        primaryAction: {
          label: t('common.delete'),
          destructive: true,
          onPress: () => {
            setMsgSheet(null);
            void (async () => {
              try {
                await mfGoOrganizations.deleteOrganizationProjectPurchase(item.id);
                setPurchases((prev) => prev.filter((x) => x.id !== item.id));
                snackbarService.success(t('profile.organizations.projects.purchaseDeleted'), 2400);
              } catch {
                showErr(t('profile.organizations.projects.purchaseDeleteFailed'));
              }
            })();
          },
        },
      });
    },
    [showErr]
  );

  const openNewPurchase = useCallback(() => {
    purchaseSheetModeRef.current = 'create';
    setEditingPurchase(null);
    setShowPurchaseSheet(true);
  }, []);

  const openEditPurchase = useCallback((item: OrganizationProjectPurchasePayload) => {
    purchaseSheetModeRef.current = 'edit';
    setEditingPurchase(item);
    setShowPurchaseSheet(true);
  }, []);

  const onPurchaseSaved = useCallback((item: OrganizationProjectPurchasePayload) => {
    setPurchases((prev) => {
      const i = prev.findIndex((x) => x.id === item.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = item;
        return next;
      }
      return [item, ...prev];
    });
    snackbarService.success(
      purchaseSheetModeRef.current === 'edit'
        ? t('profile.organizations.projects.purchaseUpdated')
        : t('profile.organizations.projects.purchaseCreated'),
      2400
    );
  }, []);

  const confirmDeleteProject = useCallback(() => {
    setMsgSheet({
      title: t('profile.organizations.projects.deleteProject'),
      message: t('profile.organizations.projects.deleteProjectConfirm'),
      variant: 'info',
      secondaryAction: {
        label: t('common.cancel'),
        onPress: () => setMsgSheet(null),
      },
      primaryAction: {
        label: t('common.delete'),
        destructive: true,
        onPress: () => {
          setMsgSheet(null);
          void (async () => {
            try {
              await mfGoOrganizations.deleteOrganizationProject(projectId);
              router.replace(`/organization/${organizationId}/projects` as never);
            } catch {
              showErr(t('profile.organizations.projects.deleteProjectFailed'));
            }
          })();
        },
      },
    });
  }, [organizationId, projectId, showErr]);

  const formatMoney = useCallback(
    (amount: number, currencyCode: string) => {
      const code = (currencyCode || 'TRY').trim().toUpperCase().slice(0, 3) || 'TRY';
      try {
        return new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
          style: 'currency',
          currency: code,
          maximumFractionDigits: 2,
        }).format(amount);
      } catch {
        return `${amount.toFixed(2)} ${code}`;
      }
    },
    [locale]
  );

  const rowBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const sectionHeaderColor = isDark ? '#8E8E93' : '#6D6D72';

  if (!user) return null;

  return (
    <>
      <AppBarScaffold
        style={{ flex: 1 }}
        backgroundColor={colors.settingsBackground}
        appBar={
          <ScreenHeader
            title={project?.name ?? t('profile.organizations.projects.detailTitle')}
            subtitle={organization?.name ?? ''}
            onBackPress={onBack}
            showBackButton
            variant="minimal"
            rightAction={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {showProjectSettingsGear ? (
                  <Pressable
                    onPress={() => {
                      setShowProjectSettings(true);
                      if (!isHostProjectContext && isParticipantOrgOwner) {
                        void loadPendingInvites();
                      }
                      if (isHostProjectContext && isAdminOrOwner) {
                        void loadInviteOrgCandidates();
                      }
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.organizations.projects.projectSettings')}
                  >
                    <Ionicons name="settings-outline" size={22} color={colors.text} />
                  </Pressable>
                ) : null}
                {isHostProjectContext && isAdminOrOwner ? (
                  <Pressable
                    onPress={confirmDeleteProject}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.organizations.projects.deleteProject')}
                  >
                    <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                  </Pressable>
                ) : null}
              </View>
            }
          />
        }
      >
        {loading ? (
          <View style={{ paddingTop: 48, alignItems: 'center' }}>
            <ActivityIndicator color={colors.tint} />
          </View>
        ) : !project ? (
          <Text style={{ color: colors.labelText, padding: 24 }}>
            {t('profile.organizations.projects.projectNotFound')}
          </Text>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void load('refresh')}
                tintColor={colors.tint}
                colors={[colors.tint]}
              />
            }
          >
            {project.description?.trim() ? (
              <Text style={{ color: colors.labelText, marginTop: 12 }}>{project.description}</Text>
            ) : null}

            {!isHostProjectContext ? (
              <View
                style={{
                  marginTop: 12,
                  alignSelf: 'flex-start',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.tint }}>
                  {t('profile.organizations.projects.sharedProjectBadge')}
                </Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.section, { color: sectionHeaderColor }]}>
                {t('profile.organizations.projects.membersSection').toUpperCase()}
              </Text>
              {isAdminOrOwner ? (
                <Pressable onPress={() => setShowAddMember(true)} hitSlop={8}>
                  <Text style={{ color: colors.tint, fontWeight: '600' }}>
                    {t('profile.organizations.projects.addMember')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: rowBg }}>
              {projMembers.length === 0 ? (
                <Text style={{ color: colors.labelText, padding: 16 }}>
                  {t('profile.organizations.projects.noMembers')}
                </Text>
              ) : (
                projMembers.map((m, i) => (
                  <View
                    key={m.id}
                    style={[
                      styles.row,
                      i < projMembers.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: isDark ? '#38383A' : '#C6C6C8',
                      },
                    ]}
                  >
                    <Ionicons name="person-circle-outline" size={24} color={colors.tint} />
                    <Text style={{ flex: 1, color: colors.bodyText, fontSize: 16 }}>
                      {m.userNickname || m.userId.slice(0, 8) + '…'}
                    </Text>
                    {isAdminOrOwner && m.userId !== user.id ? (
                      <Pressable
                        onPress={() =>
                          removeMember(m.userId, m.userNickname || m.userId.slice(0, 8))
                        }
                        hitSlop={8}
                      >
                        <Ionicons name="close-circle-outline" size={22} color={colors.icon} />
                      </Pressable>
                    ) : null}
                  </View>
                ))
              )}
            </View>

            <View
              style={[
                styles.detailTabBar,
                { borderColor: isDark ? '#38383A' : '#C6C6C8' },
              ]}
              accessibilityRole="tablist"
            >
              {(
                [
                  { id: 'todos' as const, label: t('profile.organizations.projects.detailTabTodos') },
                  {
                    id: 'purchases' as const,
                    label: t('profile.organizations.projects.detailTabPurchases'),
                  },
                ] as const
              ).map((tab, tabIndex) => {
                const active = detailTab === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setDetailTab(tab.id);
                    }}
                    activeOpacity={0.85}
                    style={[
                      styles.detailTab,
                      {
                        backgroundColor: active ? colors.tint : colors.surfaceBackground,
                        borderRightWidth:
                          tabIndex === 0 ? StyleSheet.hairlineWidth : 0,
                        borderRightColor: isDark ? '#38383A' : '#C6C6C8',
                      },
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.detailTabLabel,
                        { color: active ? onTint : colors.bodyText },
                      ]}
                      numberOfLines={1}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {detailTab === 'todos' ? (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 16,
                  }}
                >
                  <Text style={[styles.section, { color: sectionHeaderColor, marginTop: 0 }]}>
                    {t('profile.organizations.projects.todosSection').toUpperCase()}
                  </Text>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowTodoSheet(true);
                    }}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.organizations.projects.addProjectTodo')}
                  >
                    <Ionicons name="add-circle-outline" size={28} color={colors.tint} />
                  </Pressable>
                </View>

                <Text style={{ color: colors.labelText, marginTop: 6, fontSize: 12 }}>
                  {t('profile.organizations.projects.todosFilterHint')}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.filterRow}
                  keyboardShouldPersistTaps="handled"
                >
                  {(
                    [
                      { id: 'all' as const, label: t('profile.organizations.projects.todosFilterAll') },
                      {
                        id: 'unassigned' as const,
                        label: t('profile.organizations.projects.todosFilterUnassigned'),
                      },
                      { id: 'me' as const, label: t('profile.organizations.projects.todosFilterMine') },
                    ] as const
                  ).map((chip) => (
                    <TouchableOpacity
                      key={chip.id}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setAssigneeFilter(chip.id);
                      }}
                      activeOpacity={0.7}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor:
                            assigneeFilter === chip.id ? colors.tint : colors.surfaceBackground,
                          borderColor: colors.surfaceBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: assigneeFilter === chip.id ? onTint : colors.bodyText },
                        ]}
                      >
                        {chip.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {projMembersForAssigneeChips.map((m) => (
                    <TouchableOpacity
                      key={m.userId}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setAssigneeFilter(m.userId);
                      }}
                      activeOpacity={0.7}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor:
                            assigneeFilter === m.userId ? colors.tint : colors.surfaceBackground,
                          borderColor: colors.surfaceBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          {
                            color: assigneeFilter === m.userId ? onTint : colors.bodyText,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {m.userNickname || m.userId.slice(0, 8) + '…'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View
                  style={{
                    borderRadius: 12,
                    overflow: 'hidden',
                    backgroundColor: rowBg,
                    marginTop: 8,
                  }}
                >
                  {todos.length === 0 ? (
                    <Text style={{ color: colors.labelText, padding: 16 }}>
                      {t('profile.organizations.projects.noTodos')}
                    </Text>
                  ) : filteredTodos.length === 0 ? (
                    <Text style={{ color: colors.labelText, padding: 16 }}>
                      {t('profile.organizations.projects.todosFilterEmpty')}
                    </Text>
                  ) : (
                    filteredTodos.map((item, i) => {
                      const done = item.status === 'DONE';
                      const dueText =
                        item.dueAt && !Number.isNaN(new Date(item.dueAt).getTime())
                          ? new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            }).format(new Date(item.dueAt))
                          : null;
                      const { leadingEmoji, body } = splitLeadingTodoEmoji(item.title);
                      const titleLineStyle = {
                        fontSize: 16,
                        color: colors.bodyText,
                        textDecorationLine: done ? ('line-through' as const) : ('none' as const),
                        opacity: done ? 0.6 : 1,
                      };
                      return (
                        <View
                          key={item.id}
                          style={
                            i < filteredTodos.length - 1
                              ? {
                                  borderBottomWidth: StyleSheet.hairlineWidth,
                                  borderBottomColor: isDark ? '#38383A' : '#C6C6C8',
                                }
                              : undefined
                          }
                        >
                          <View style={styles.row}>
                            <Pressable onPress={() => void toggleTodo(item)} style={styles.todoRow}>
                              <Ionicons
                                name={item.status === 'DONE' ? 'checkmark-circle' : 'ellipse-outline'}
                                size={24}
                                color={
                                  item.status === 'DONE'
                                    ? colors.successColor ?? '#34C759'
                                    : colors.icon
                                }
                              />
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <View
                                  style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}
                                >
                                  {leadingEmoji ? (
                                    <Text
                                      style={{
                                        fontSize: 16,
                                        lineHeight: 22,
                                        color: colors.bodyText,
                                      }}
                                    >
                                      {leadingEmoji}
                                    </Text>
                                  ) : null}
                                  <Text
                                    style={[{ flex: 1, minWidth: 0, lineHeight: 22 }, titleLineStyle]}
                                  >
                                    {leadingEmoji ? body : item.title}
                                  </Text>
                                </View>
                                {item.assignedToUserId ? (
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      color: colors.labelText,
                                      marginTop: 2,
                                    }}
                                  >
                                    {t('profile.organizations.projects.todoAssignee', {
                                      name:
                                        projectMemberNickByUserId.get(item.assignedToUserId) ??
                                        `${item.assignedToUserId.slice(0, 8)}…`,
                                    })}
                                  </Text>
                                ) : null}
                                {dueText ? (
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      color: colors.labelText,
                                      marginTop: 2,
                                    }}
                                  >
                                    {t('home.todos.dueDateLabel')}: {dueText}
                                  </Text>
                                ) : null}
                              </View>
                            </Pressable>
                            <Pressable onPress={() => confirmDeleteTodo(item)} hitSlop={8}>
                              <Ionicons name="trash-outline" size={20} color={colors.icon} />
                            </Pressable>
                          </View>
                          {Array.isArray(item.subtasks) ? (
                            <View
                              style={{
                                paddingLeft: 42,
                                paddingRight: 14,
                                paddingBottom: 12,
                                gap: 6,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: '600',
                                  color: sectionHeaderColor,
                                  marginBottom: 2,
                                }}
                              >
                                {t('home.todos.subtasksSection')}
                              </Text>
                              {item.subtasks.map((st) => (
                                <View
                                  key={st.id}
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                  }}
                                >
                                  <Pressable
                                    onPress={() => void toggleProjectSubtask(item, st)}
                                    disabled={projectSubtasksBusy}
                                    hitSlop={6}
                                  >
                                    <Ionicons
                                      name={st.completed ? 'checkmark-circle' : 'ellipse-outline'}
                                      size={20}
                                      color={
                                        st.completed
                                          ? colors.successColor ?? '#34C759'
                                          : colors.icon
                                      }
                                    />
                                  </Pressable>
                                  <Text
                                    style={{
                                      flex: 1,
                                      fontSize: 14,
                                      color: colors.bodyText,
                                      textDecorationLine: st.completed ? 'line-through' : 'none',
                                      opacity: st.completed ? 0.65 : 1,
                                    }}
                                  >
                                    {st.title}
                                  </Text>
                                  <Pressable
                                    onPress={() => void deleteProjectSubtask(item, st.id)}
                                    disabled={projectSubtasksBusy}
                                    hitSlop={8}
                                    accessibilityLabel={t('home.todos.subtaskDeleteA11y')}
                                  >
                                    <Ionicons name="trash-outline" size={18} color={colors.icon} />
                                  </Pressable>
                                </View>
                              ))}
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <TextInput
                                  value={projectSubtaskDrafts[item.id] ?? ''}
                                  onChangeText={(v) =>
                                    setProjectSubtaskDrafts((d) => ({ ...d, [item.id]: v }))
                                  }
                                  placeholder={t('home.todos.subtaskPlaceholder')}
                                  placeholderTextColor={colors.labelText}
                                  editable={!projectSubtasksBusy}
                                  style={{
                                    flex: 1,
                                    borderWidth: StyleSheet.hairlineWidth,
                                    borderColor: isDark ? '#38383A' : '#C6C6C8',
                                    borderRadius: 8,
                                    paddingHorizontal: 10,
                                    paddingVertical: 8,
                                    fontSize: 14,
                                    color: colors.bodyText,
                                  }}
                                />
                                <TouchableOpacity
                                  onPress={() => void addProjectSubtask(item)}
                                  disabled={
                                    projectSubtasksBusy ||
                                    !(projectSubtaskDrafts[item.id] ?? '').trim()
                                  }
                                  activeOpacity={0.85}
                                  style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    borderRadius: 8,
                                    backgroundColor:
                                      projectSubtasksBusy ||
                                      !(projectSubtaskDrafts[item.id] ?? '').trim()
                                        ? colors.surfaceBorder
                                        : colors.tint,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 13,
                                      fontWeight: '600',
                                      color:
                                        projectSubtasksBusy ||
                                        !(projectSubtaskDrafts[item.id] ?? '').trim()
                                          ? colors.labelText
                                          : onTint,
                                    }}
                                  >
                                    {t('home.todos.subtaskAdd')}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </View>
              </>
            ) : (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 16,
                  }}
                >
                  <Text style={[styles.section, { color: sectionHeaderColor, marginTop: 0 }]}>
                    {t('profile.organizations.projects.purchasesSection').toUpperCase()}
                  </Text>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      openNewPurchase();
                    }}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.organizations.projects.addPurchase')}
                  >
                    <Ionicons name="add-circle-outline" size={28} color={colors.tint} />
                  </Pressable>
                </View>

                <View
                  style={{
                    borderRadius: 12,
                    overflow: 'hidden',
                    backgroundColor: rowBg,
                    marginTop: 8,
                  }}
                >
                  {purchases.length === 0 ? (
                    <Text style={{ color: colors.labelText, padding: 16, fontSize: 15, lineHeight: 22 }}>
                      {t('profile.organizations.projects.purchasesEmpty')}
                    </Text>
                  ) : (
                    purchases.map((item, i) => {
                      const subtotal = item.price * item.quantity;
                      const withTax = subtotal * (1 + (item.taxRate > 0 ? item.taxRate : 0));
                      const statusKey = item.status as 'REQUESTED' | 'PURCHASED' | 'CANCELLED';
                      const statusLabel = t(`profile.organizations.projects.purchaseStatus.${statusKey}`);
                      const statusBg =
                        item.status === 'PURCHASED'
                          ? (colors.successColor ?? '#34C759') + '22'
                          : item.status === 'CANCELLED'
                            ? (isDark ? '#48484A' : '#E5E5EA')
                            : colors.tint + '22';
                      const statusFg =
                        item.status === 'PURCHASED'
                          ? colors.successColor ?? '#34C759'
                          : item.status === 'CANCELLED'
                            ? colors.labelText
                            : colors.tint;
                      const link = item.productLink?.trim();
                      return (
                        <View
                          key={item.id}
                          style={[
                            styles.row,
                            { alignItems: 'flex-start' },
                            i < purchases.length - 1 && {
                              borderBottomWidth: StyleSheet.hairlineWidth,
                              borderBottomColor: isDark ? '#38383A' : '#C6C6C8',
                            },
                          ]}
                        >
                          <Pressable
                            onPress={() => openEditPurchase(item)}
                            style={{ flex: 1, minWidth: 0 }}
                          >
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: 8,
                              }}
                            >
                              <Text
                                style={{
                                  flex: 1,
                                  color: colors.bodyText,
                                  fontSize: 16,
                                  fontWeight: '600',
                                }}
                                numberOfLines={3}
                              >
                                {item.productName}
                              </Text>
                              <View
                                style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                  borderRadius: 8,
                                  backgroundColor: statusBg,
                                }}
                              >
                                <Text style={{ fontSize: 11, fontWeight: '700', color: statusFg }}>
                                  {statusLabel}
                                </Text>
                              </View>
                            </View>
                            <Text style={{ color: colors.labelText, fontSize: 13, marginTop: 6 }}>
                              {formatMoney(item.price, item.currency)} × {item.quantity} ={' '}
                              {formatMoney(subtotal, item.currency)}
                              {item.taxRate > 0
                                ? ` · ${t('profile.organizations.projects.purchaseLineWithTax', {
                                    amount: formatMoney(withTax, item.currency),
                                  })}`
                                : ''}
                            </Text>
                            {item.productPurpose?.trim() ? (
                              <Text
                                style={{ color: colors.bodyText, fontSize: 13, marginTop: 6 }}
                                numberOfLines={4}
                              >
                                {item.productPurpose.trim()}
                              </Text>
                            ) : null}
                            {item.statusNote?.trim() ? (
                              <Text style={{ color: colors.labelText, fontSize: 12, marginTop: 4 }}>
                                {t('profile.organizations.projects.purchaseNoteLabel')}:{' '}
                                {item.statusNote.trim()}
                              </Text>
                            ) : null}
                            {link ? (
                              <Pressable
                                onPress={() => void Linking.openURL(link)}
                                style={{ marginTop: 8, alignSelf: 'flex-start' }}
                                hitSlop={6}
                              >
                                <Text
                                  style={{
                                    color: colors.tint,
                                    fontSize: 13,
                                    textDecorationLine: 'underline',
                                  }}
                                  numberOfLines={2}
                                >
                                  {t('profile.organizations.projects.purchaseOpenLink')}
                                </Text>
                              </Pressable>
                            ) : null}
                          </Pressable>
                          <Pressable onPress={() => confirmDeletePurchase(item)} hitSlop={8}>
                            <Ionicons name="trash-outline" size={20} color={colors.icon} />
                          </Pressable>
                        </View>
                      );
                    })
                  )}
                </View>
              </>
            )}
          </ScrollView>
        )}
      </AppBarScaffold>

      <Modal visible={showProjectSettings} transparent animationType="fade">
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
            padding: 20,
          }}
          onPress={() => setShowProjectSettings(false)}
        >
          <Pressable
            style={{
              backgroundColor: rowBg,
              borderRadius: 14,
              padding: 16,
              maxHeight: '88%',
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.bodyText }}>
                {t('profile.organizations.projects.projectSettingsTitle')}
              </Text>

              {isHostProjectContext && isAdminOrOwner ? (
                <>
                  <Text style={{ color: colors.bodyText, marginTop: 12, fontSize: 16, fontWeight: '600' }}>
                    {t('profile.organizations.projects.inviteParticipantOrgTitle')}
                  </Text>
                  <Text style={{ color: colors.labelText, marginTop: 6, fontSize: 13 }}>
                    {t('profile.organizations.projects.inviteParticipantOrgHint')}
                  </Text>
                  <Pressable
                    onPress={() => setShowInviteOrgPicker(true)}
                    style={{
                      marginTop: 12,
                      borderWidth: 1,
                      borderColor: colors.surfaceBorder,
                      borderRadius: 10,
                      padding: 12,
                      opacity: inviteOrgCandidatesLoading ? 0.7 : 1,
                    }}
                    disabled={inviteOrgCandidatesLoading}
                  >
                    <Text style={{ color: colors.bodyText, fontSize: 14, fontWeight: '600' }}>
                      {selectedInviteOrgName ??
                        t('profile.organizations.projects.inviteSelectOrgButton')}
                    </Text>
                    <Text style={{ color: colors.labelText, marginTop: 4, fontSize: 12 }}>
                      {inviteOrgCandidatesLoading
                        ? t('common.loading')
                        : t('profile.organizations.projects.inviteSelectOrgHint')}
                    </Text>
                  </Pressable>
                  <TextInput
                    value={inviteParticipantOrgId}
                    onChangeText={setInviteParticipantOrgId}
                    placeholder={t('profile.organizations.projects.inviteParticipantOrgPlaceholder')}
                    placeholderTextColor={colors.labelText}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.surfaceBorder,
                      borderRadius: 10,
                      padding: 12,
                      marginTop: 12,
                      color: colors.bodyText,
                    }}
                  />
                  <Text style={{ color: colors.bodyText, marginTop: 14, fontSize: 15, fontWeight: '600' }}>
                    {t('profile.organizations.projects.inviteCapabilitiesSection')}
                  </Text>
                  <Text style={{ color: colors.labelText, marginTop: 4, fontSize: 12 }}>
                    {t('profile.organizations.projects.inviteCapabilitiesHint')}
                  </Text>
                  <View
                    style={{
                      marginTop: 10,
                      borderWidth: 1,
                      borderColor: colors.surfaceBorder,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 10,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.surfaceBorder,
                      }}
                    >
                      <Text style={{ color: colors.bodyText, fontSize: 15, flex: 1, paddingRight: 12 }}>
                        {t('profile.organizations.projects.inviteCapabilityTodos')}
                      </Text>
                      <Switch
                        value={inviteCapTodos}
                        onValueChange={setInviteCapTodos}
                        trackColor={{ false: isDark ? '#3A3A3C' : '#D1D1D6', true: colors.tint + '99' }}
                        thumbColor={isDark ? '#F2F2F7' : '#FFF'}
                      />
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 10,
                      }}
                    >
                      <Text style={{ color: colors.bodyText, fontSize: 15, flex: 1, paddingRight: 12 }}>
                        {t('profile.organizations.projects.inviteCapabilityPurchases')}
                      </Text>
                      <Switch
                        value={inviteCapPurchases}
                        onValueChange={setInviteCapPurchases}
                        trackColor={{ false: isDark ? '#3A3A3C' : '#D1D1D6', true: colors.tint + '99' }}
                        thumbColor={isDark ? '#F2F2F7' : '#FFF'}
                      />
                    </View>
                  </View>
                  <Pressable
                    disabled={inviteFlowBusy || !inviteParticipantOrgId.trim()}
                    onPress={() => void submitOrgProjectInvite()}
                    style={{
                      marginTop: 16,
                      paddingVertical: 14,
                      backgroundColor: colors.tint,
                      borderRadius: 10,
                      opacity: inviteFlowBusy || !inviteParticipantOrgId.trim() ? 0.55 : 1,
                    }}
                  >
                    {inviteFlowBusy ? (
                      <ActivityIndicator color={onTint} />
                    ) : (
                      <Text style={{ color: onTint, textAlign: 'center', fontWeight: '700' }}>
                        {t('profile.organizations.projects.inviteSend')}
                      </Text>
                    )}
                  </Pressable>
                </>
              ) : null}

              {!isHostProjectContext && isParticipantOrgOwner ? (
                <>
                  {pendingInvitesLoading ? (
                    <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                      <ActivityIndicator color={colors.tint} />
                    </View>
                  ) : pendingInviteForThisProject ? (
                    <>
                      <Text style={{ color: colors.bodyText, marginTop: 14, fontSize: 16, fontWeight: '600' }}>
                        {t('profile.organizations.projects.acceptInviteTitle')}
                      </Text>
                      <Text style={{ color: colors.labelText, marginTop: 8, fontSize: 14 }}>
                        {t('profile.organizations.projects.acceptInviteSubtitle', {
                          host: pendingInviteForThisProject.hostOrganizationName,
                          project: pendingInviteForThisProject.projectName,
                        })}
                      </Text>
                      <Pressable
                        disabled={inviteFlowBusy}
                        onPress={() => void acceptOrgProjectInvite()}
                        style={{
                          marginTop: 16,
                          paddingVertical: 14,
                          backgroundColor: colors.tint,
                          borderRadius: 10,
                          opacity: inviteFlowBusy ? 0.6 : 1,
                        }}
                      >
                        <Text style={{ color: onTint, textAlign: 'center', fontWeight: '700' }}>
                          {t('profile.organizations.projects.acceptInviteButton')}
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <Text style={{ color: colors.labelText, marginTop: 14 }}>
                      {t('profile.organizations.projects.noPendingInviteForProject')}
                    </Text>
                  )}
                </>
              ) : null}

              <Pressable
                onPress={() => !inviteFlowBusy && setShowProjectSettings(false)}
                disabled={inviteFlowBusy}
                style={{ marginTop: 18, opacity: inviteFlowBusy ? 0.6 : 1 }}
              >
                <Text style={{ color: colors.tint, textAlign: 'center', fontWeight: '600' }}>
                  {t('common.close')}
                </Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showInviteOrgPicker} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ maxHeight: '72%', backgroundColor: rowBg, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.surfaceBorder,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.bodyText }}>
                {t('profile.organizations.projects.inviteSelectOrgTitle')}
              </Text>
              <Pressable onPress={() => setShowInviteOrgPicker(false)}>
                <Text style={{ color: colors.tint }}>{t('common.done')}</Text>
              </Pressable>
            </View>
            <ScrollView>
              {inviteOrgCandidates.length === 0 ? (
                <Text style={{ color: colors.labelText, padding: 20 }}>
                  {t('profile.organizations.projects.inviteNoOrgCandidates')}
                </Text>
              ) : (
                inviteOrgCandidates.map((org) => {
                  const selected = inviteParticipantOrgId.trim() === org.id;
                  return (
                    <Pressable
                      key={org.id}
                      onPress={() => {
                        setInviteParticipantOrgId(org.id);
                        setShowInviteOrgPicker(false);
                      }}
                      style={[
                        styles.modalPickRow,
                        {
                          borderBottomColor: isDark ? '#38383A' : '#C6C6C8',
                          backgroundColor: selected ? colors.tint + '18' : 'transparent',
                        },
                      ]}
                    >
                      <Text style={{ color: colors.bodyText, fontSize: 16, fontWeight: '600' }}>
                        {org.name}
                      </Text>
                      <Text style={{ color: colors.labelText, fontSize: 12, marginTop: 4 }}>
                        {org.id}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddMember} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ maxHeight: '70%', backgroundColor: rowBg, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.surfaceBorder,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.bodyText }}>
                {t('profile.organizations.projects.addMember')}
              </Text>
              <Pressable onPress={() => setShowAddMember(false)}>
                <Text style={{ color: colors.tint }}>{t('common.done')}</Text>
              </Pressable>
            </View>
            <ScrollView>
              {candidatesToAdd.length === 0 ? (
                <Text style={{ color: colors.labelText, padding: 20 }}>
                  {t('profile.organizations.projects.noMembersToAdd')}
                </Text>
              ) : (
                candidatesToAdd.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => void addMember(m.userID)}
                    style={[
                      styles.modalPickRow,
                      { borderBottomColor: isDark ? '#38383A' : '#C6C6C8' },
                    ]}
                  >
                    <Text style={{ color: colors.bodyText, fontSize: 16 }}>
                      {m.userNickname || m.userID.slice(0, 8) + '…'}
                    </Text>
                    <Text style={{ color: colors.labelText, fontSize: 13, marginTop: 4 }}>
                      {m.role}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <OrganizationProjectPurchaseSheet
        visible={showPurchaseSheet}
        onClose={() => {
          setShowPurchaseSheet(false);
          setEditingPurchase(null);
        }}
        projectId={projectId}
        purchase={editingPurchase}
        onSaved={onPurchaseSaved}
        onErrorMessage={showErr}
      />

      <TodoSheet
        visible={showTodoSheet}
        todo={null}
        organizations={organization ? [organization] : []}
        currentUserId={user?.id ?? null}
        fixedOrganizationId={organizationId}
        fixedProjectId={projectId}
        fixedProjectName={project?.name ?? null}
        fetchOrgMembers={fetchOrgMembersForSheet}
        onClose={() => setShowTodoSheet(false)}
        onSave={saveTodoFromSheet}
      />

      <MessageBottomSheet
        visible={!!msgSheet}
        onDismiss={() => setMsgSheet(null)}
        title={msgSheet?.title ?? ''}
        message={msgSheet?.message ?? ''}
        variant={msgSheet?.variant ?? 'info'}
        primaryAction={msgSheet?.primaryAction ?? okSheetAction(() => setMsgSheet(null))}
        secondaryAction={msgSheet?.secondaryAction}
      />
    </>
  );
}
