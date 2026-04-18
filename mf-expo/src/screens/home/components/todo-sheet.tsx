import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { t } from '@/src/shared/i18n';
import { snackbarService } from '@/src/shared/services/snackbar-service';
import { themedTextInputProps } from '@/src/shared/utils/themed-text-input';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  mfGoOrganizations,
  mfGoTodos,
  type UserTodoPayload,
  type UserTodoSubtaskPayload,
  type OrganizationPayload,
  type OrganizationMemberPayload,
  type OrganizationProjectPayload,
  type OrganizationProjectMemberPayload,
} from '@/src/shared/services/mf-go-api';
import type { LocalTodoPayload } from '@/src/shared/services/local-todos-service';
import { useLocale } from '@/src/shared/hooks/use-locale';
import {
  TODO_EMOJIS,
  TODO_EMOJI_DEFAULT,
  parseTodoTitle,
  buildTodoTitle,
} from '../constants/todo-emojis';

const TITLE_MAX = 500;

/** Android `mode="datetime"` is unreliable (RNDateTimePickerAndroid dismiss undefined); use date then time. */
function mergeDateWithTimeOfDay(datePart: Date, timeSource: Date): Date {
  const out = new Date(datePart);
  out.setHours(
    timeSource.getHours(),
    timeSource.getMinutes(),
    timeSource.getSeconds(),
    timeSource.getMilliseconds()
  );
  return out;
}

export interface TodoSheetSaveInput {
  title: string;
  completed?: boolean;
  id?: string;
  organizationID?: string | null;
  assignedToUserID?: string | null;
  /** When set on create, saves as an organization project todo (not `myTodos`). */
  organizationProjectId?: string | null;
  /** ISO8601 UTC when a due date/time is set */
  dueAt?: string | null;
  /** When editing, clear stored due time on the server */
  clearDueAt?: boolean;
}

interface TodoSheetProps {
  visible: boolean;
  todo: UserTodoPayload | LocalTodoPayload | null;
  organizations: OrganizationPayload[];
  /** Signed-in mf-go user id; used to detect org owner/admin for project-todo assignee picker. */
  currentUserId?: string | null;
  /**
   * When both are set (e.g. organization project detail), org/project pickers are hidden and
   * new todos always save against this project via `onSave` (`organizationProjectId` in input).
   */
  fixedOrganizationId?: string | null;
  fixedProjectId?: string | null;
  /** Display label for fixed project mode (project name). */
  fixedProjectName?: string | null;
  /**
   * When editing an **organization project todo** from home (filtered project list), lock org/project
   * in the sheet and hide pickers — save/delete are handled by the parent via project-todo APIs.
   */
  organizationProjectEditLock?: {
    organizationId: string;
    projectId: string;
    organizationName: string;
    projectName: string;
  } | null;
  fetchOrgMembers: (orgId: string) => Promise<OrganizationMemberPayload[]>;
  onClose: () => void;
  onSave: (input: TodoSheetSaveInput) => Promise<string | null>;
  onDelete?: (id: string) => Promise<string | null>;
  /** After subtask create/update/delete; refresh home list without full skeleton. */
  onSubtasksChanged?: () => void;
}

export function TodoSheet({
  visible,
  todo,
  organizations,
  currentUserId = null,
  fixedOrganizationId = null,
  fixedProjectId = null,
  fixedProjectName = null,
  organizationProjectEditLock = null,
  fetchOrgMembers,
  onClose,
  onSave,
  onDelete,
  onSubtasksChanged,
}: TodoSheetProps) {
  const { locale } = useLocale();
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const textInputTheme = themedTextInputProps(colors, isDark);
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const [title, setTitle] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState(TODO_EMOJI_DEFAULT);
  const [completed, setCompleted] = useState(false);
  const [organizationID, setOrganizationID] = useState<string | null>(null);
  const [organizationProjectId, setOrganizationProjectId] = useState<string | null>(null);
  const [orgProjects, setOrgProjects] = useState<OrganizationProjectPayload[]>([]);
  const [orgProjectsLoading, setOrgProjectsLoading] = useState(false);
  const [assignedToUserID, setAssignedToUserID] = useState<string | null>(null);
  const [members, setMembers] = useState<OrganizationMemberPayload[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [projectMembers, setProjectMembers] = useState<OrganizationProjectMemberPayload[]>([]);
  const [projectMembersLoading, setProjectMembersLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmSheet, setConfirmSheet] = useState<{
    type: 'toPersonal' | 'toOrg';
    orgName?: string;
    orgId?: string;
  } | null>(null);
  const [dueAt, setDueAt] = useState<Date | null>(null);
  const [duePickerExpanded, setDuePickerExpanded] = useState(false);
  /** Android: sequential date → time pickers (avoid `mode="datetime"` crash). */
  const [androidDuePickerStep, setAndroidDuePickerStep] = useState<null | 'date' | 'time'>(null);
  const [androidPendingDueDate, setAndroidPendingDueDate] = useState<Date | null>(null);
  const [subtasksLocal, setSubtasksLocal] = useState<UserTodoSubtaskPayload[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [subtasksBusy, setSubtasksBusy] = useState(false);
  const confirmSheetRef = useRef(confirmSheet);
  confirmSheetRef.current = confirmSheet;

  const isEdit = !!todo;
  const isBusy = isSaving || isDeleting;
  const showUserSubtasks =
    isEdit &&
    todo &&
    !todo.id.startsWith('local-') &&
    Array.isArray((todo as UserTodoPayload).subtasks);
  const isFixedProjectSheet = !!(fixedOrganizationId && fixedProjectId && !isEdit);
  const showFixedProjectContextStrip =
    isFixedProjectSheet || (!!organizationProjectEditLock && isEdit);
  const isLockedProjectTodoEdit = !!(organizationProjectEditLock && isEdit);
  /** Org **General (my list)** new todo: assignee is always the signed-in user (no roster picker). */
  const isOrgGeneralCreate =
    !isEdit && !!organizationID && !organizationProjectId && !isFixedProjectSheet;

  /** Ignore stale responses when org changes quickly or sheet re-inits. */
  const membersRequestRef = useRef(0);
  const orgProjectsRequestRef = useRef(0);
  const projectMembersRequestRef = useRef(0);
  const titleInputRef = useRef<TextInput>(null);
  const sheetOpenFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMembers = useCallback(
    async (orgId: string) => {
      const req = ++membersRequestRef.current;
      setMembersLoading(true);
      try {
        const m = await fetchOrgMembers(orgId);
        if (req === membersRequestRef.current) {
          setMembers(m);
        }
      } catch {
        if (req === membersRequestRef.current) {
          setMembers([]);
        }
      } finally {
        if (req === membersRequestRef.current) {
          setMembersLoading(false);
        }
      }
    },
    [fetchOrgMembers]
  );

  const loadOrgProjects = useCallback(async (orgId: string) => {
    const req = ++orgProjectsRequestRef.current;
    setOrgProjectsLoading(true);
    try {
      const list = await mfGoOrganizations.organizationProjects(orgId);
      if (req === orgProjectsRequestRef.current) {
        setOrgProjects(list);
      }
    } catch {
      if (req === orgProjectsRequestRef.current) {
        setOrgProjects([]);
      }
    } finally {
      if (req === orgProjectsRequestRef.current) {
        setOrgProjectsLoading(false);
      }
    }
  }, []);

  const loadProjectMembers = useCallback(async (projectId: string) => {
    const req = ++projectMembersRequestRef.current;
    setProjectMembersLoading(true);
    try {
      const list = await mfGoOrganizations.organizationProjectMembers(projectId);
      if (req === projectMembersRequestRef.current) {
        setProjectMembers(list);
      }
    } catch {
      if (req === projectMembersRequestRef.current) {
        setProjectMembers([]);
      }
    } finally {
      if (req === projectMembersRequestRef.current) {
        setProjectMembersLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!visible) setConfirmSheet(null);
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setDuePickerExpanded(false);
      setAndroidDuePickerStep(null);
      setAndroidPendingDueDate(null);
    }
  }, [visible]);

  const formatDueLabel = useCallback(
    (d: Date) =>
      new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(d),
    [locale]
  );

  useEffect(() => {
    if (!visible || !organizationID || isEdit || fixedProjectId) {
      orgProjectsRequestRef.current += 1;
      setOrgProjects([]);
      setOrgProjectsLoading(false);
      return;
    }
    void loadOrgProjects(organizationID);
  }, [visible, organizationID, isEdit, fixedProjectId, loadOrgProjects]);

  useEffect(() => {
    if (!visible || !organizationProjectId || isEdit) {
      projectMembersRequestRef.current += 1;
      setProjectMembers([]);
      setProjectMembersLoading(false);
      return;
    }
    void loadProjectMembers(organizationProjectId);
  }, [visible, organizationProjectId, isEdit, loadProjectMembers]);

  /** General (my list) create: lock assignee to the current user. */
  useEffect(() => {
    if (!visible || !isOrgGeneralCreate || !currentUserId) return;
    setAssignedToUserID((prev) => (prev === currentUserId ? prev : currentUserId));
  }, [visible, isOrgGeneralCreate, currentUserId]);

  /** Focus title once after sheet opens (only when `visible` flips on). Confirm flow clears the timer so keyboard never covers the confirm sheet. */
  useEffect(() => {
    if (!visible) return;
    sheetOpenFocusTimerRef.current = setTimeout(() => {
      sheetOpenFocusTimerRef.current = null;
      if (!confirmSheetRef.current) {
        titleInputRef.current?.focus();
      }
    }, 400);
    return () => {
      if (sheetOpenFocusTimerRef.current) {
        clearTimeout(sheetOpenFocusTimerRef.current);
        sheetOpenFocusTimerRef.current = null;
      }
    };
  }, [visible]);

  /** Confirm sheet: dismiss keyboard + blur so the native keyboard layer does not hide the dialog. */
  useEffect(() => {
    if (!confirmSheet) return;
    if (sheetOpenFocusTimerRef.current) {
      clearTimeout(sheetOpenFocusTimerRef.current);
      sheetOpenFocusTimerRef.current = null;
    }
    titleInputRef.current?.blur();
    Keyboard.dismiss();
  }, [confirmSheet]);

  /**
   * Initialise form when the sheet opens or when switching to another todo.
   * Load members using `todo.organizationID` here — not a separate effect on `organizationID`,
   * because on the first commit after open, `organizationID` state is still stale (previous
   * sheet/session), and an effect on `organizationID` would skip fetch and clear assignee.
   */
  useEffect(() => {
    if (!visible || !todo) {
      setSubtasksLocal([]);
      setNewSubtaskTitle('');
      return;
    }
    const st = (todo as UserTodoPayload).subtasks;
    if (Array.isArray(st)) {
      setSubtasksLocal([...st]);
    } else {
      setSubtasksLocal([]);
    }
    setNewSubtaskTitle('');
  }, [visible, todo]);

  useEffect(() => {
    if (!visible) return;

    if (todo) {
      const { emoji, text } = parseTodoTitle(todo.title);
      setSelectedEmoji(emoji);
      setTitle(text);
      setCompleted(todo.completed);
      const orgId = todo.organizationID ?? null;
      if (organizationProjectEditLock) {
        setOrganizationID(organizationProjectEditLock.organizationId);
        setOrganizationProjectId(organizationProjectEditLock.projectId);
      } else {
        setOrganizationID(orgId);
        setOrganizationProjectId(null);
      }
      setAssignedToUserID(todo.assignedToUserID ?? null);
      {
        const rawDue = 'dueAt' in todo && todo.dueAt ? new Date(todo.dueAt) : null;
        setDueAt(rawDue && !Number.isNaN(rawDue.getTime()) ? rawDue : null);
      }
      setValidationError(null);
      setSubmitError(null);
      if (orgId && !organizationProjectEditLock) {
        setMembers([]);
        void loadMembers(orgId);
      } else {
        membersRequestRef.current += 1;
        setMembers([]);
        setMembersLoading(false);
      }
    } else {
      setSelectedEmoji(TODO_EMOJI_DEFAULT);
      setTitle('');
      setCompleted(false);
      if (fixedOrganizationId && fixedProjectId) {
        setOrganizationID(fixedOrganizationId);
        setOrganizationProjectId(fixedProjectId);
        setAssignedToUserID(null);
        projectMembersRequestRef.current += 1;
        setProjectMembers([]);
        setProjectMembersLoading(false);
        membersRequestRef.current += 1;
        setMembers([]);
        setMembersLoading(false);
        void loadMembers(fixedOrganizationId);
      } else {
        setOrganizationID(null);
        setOrganizationProjectId(null);
        setAssignedToUserID(null);
        projectMembersRequestRef.current += 1;
        setProjectMembers([]);
        setProjectMembersLoading(false);
        membersRequestRef.current += 1;
        setMembers([]);
        setMembersLoading(false);
      }
      setDueAt(null);
      setValidationError(null);
      setSubmitError(null);
    }
  }, [
    visible,
    todo?.id,
    todo?.organizationID,
    todo?.assignedToUserID,
    todo?.title,
    todo?.completed,
    todo?.dueAt,
    fixedOrganizationId,
    fixedProjectId,
    organizationProjectEditLock,
    loadMembers,
  ]);

  const isOrgAdminOrOwner = useMemo(() => {
    if (!currentUserId || !organizationID) return false;
    const org = organizations.find((o) => o.id === organizationID);
    if (org?.ownerUserID === currentUserId) return true;
    const row = members.find((m) => m.userID === currentUserId);
    return row?.role === 'OWNER' || row?.role === 'ADMIN';
  }, [currentUserId, organizationID, organizations, members]);

  const handleSave = async () => {
    setValidationError(null);
    setSubmitError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setValidationError(t('home.todos.titlePlaceholder'));
      return;
    }
    if (trimmed.length > TITLE_MAX) {
      setValidationError(`Title must be at most ${TITLE_MAX} characters`);
      return;
    }

    const fullTitle = buildTodoTitle(selectedEmoji, trimmed);
    const wasOrgTodo = !!(todo?.organizationID);
    const switchingToPersonal =
      wasOrgTodo &&
      !organizationID &&
      !fixedProjectId &&
      !organizationProjectEditLock;

    let assigneeForSave: string | undefined;
    if (isOrgGeneralCreate) {
      /** General (my list) create: always self — never use the org-member branch (GFG-92 / GFG-95). */
      assigneeForSave = (currentUserId ?? assignedToUserID) || undefined;
    } else if (organizationID && !organizationProjectId) {
      assigneeForSave = assignedToUserID || undefined;
    } else if (organizationID && organizationProjectId && isOrgAdminOrOwner) {
      assigneeForSave = assignedToUserID || undefined;
    } else {
      assigneeForSave = undefined;
    }

    const hadDue =
      !!todo &&
      'dueAt' in todo &&
      !!todo.dueAt &&
      !Number.isNaN(new Date(todo.dueAt).getTime());

    let dueAtIso: string | undefined;
    let clearDueAtFlag: boolean | undefined;
    if (dueAt) {
      dueAtIso = dueAt.toISOString();
    } else if (isEdit && hadDue) {
      clearDueAtFlag = true;
    }

    setIsSaving(true);
    try {
      const apiError = await onSave({
        title: fullTitle,
        ...(isEdit && { id: todo!.id, completed }),
        organizationID: organizationID || undefined,
        assignedToUserID: assigneeForSave,
        organizationProjectId: organizationProjectId || undefined,
        ...(dueAtIso ? { dueAt: dueAtIso } : {}),
        ...(clearDueAtFlag ? { clearDueAt: true } : {}),
      });
      if (apiError) {
        setSubmitError(apiError);
      } else {
        if (switchingToPersonal) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          snackbarService.success(t('home.todos.movedToPersonal'), 2500);
        }
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectPersonal = useCallback(() => {
    if (organizationProjectEditLock) return;
    if (fixedProjectId) return;
    if (organizationID) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      titleInputRef.current?.blur();
      Keyboard.dismiss();
      setConfirmSheet({ type: 'toPersonal' });
    } else {
      setOrganizationID(null);
      setOrganizationProjectId(null);
      setAssignedToUserID(null);
    }
  }, [organizationID, fixedProjectId, organizationProjectEditLock]);

  const handleSelectOrg = useCallback(
    (org: OrganizationPayload) => {
      if (organizationProjectEditLock) return;
      if (fixedProjectId) return;
      if (!organizationID) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        titleInputRef.current?.blur();
        Keyboard.dismiss();
        setConfirmSheet({ type: 'toOrg', orgName: org.name, orgId: org.id });
      } else if (organizationID !== org.id) {
        setOrganizationProjectId(null);
        setAssignedToUserID(!isEdit && currentUserId ? currentUserId : null);
        setMembers([]);
        setOrganizationID(org.id);
        void loadMembers(org.id);
      }
    },
    [organizationID, loadMembers, fixedProjectId, isEdit, currentUserId, organizationProjectEditLock]
  );

  const fixedOrgMeta = useMemo(() => {
    if (!fixedOrganizationId) return null;
    return organizations.find((o) => o.id === fixedOrganizationId) ?? null;
  }, [fixedOrganizationId, organizations]);

  const handleConfirmSheetConfirm = useCallback(() => {
    if (!confirmSheet) return;
    if (confirmSheet.type === 'toPersonal') {
      membersRequestRef.current += 1;
      setOrganizationID(null);
      setOrganizationProjectId(null);
      setAssignedToUserID(null);
      setMembers([]);
      setMembersLoading(false);
    } else if (confirmSheet.type === 'toOrg' && confirmSheet.orgId) {
      setOrganizationProjectId(null);
      setOrganizationID(confirmSheet.orgId);
      setAssignedToUserID(!todo && currentUserId ? currentUserId : null);
      setMembers([]);
      void loadMembers(confirmSheet.orgId);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Keyboard.dismiss();
    setConfirmSheet(null);
  }, [confirmSheet, loadMembers, todo, currentUserId]);

  const handleConfirmSheetCancel = useCallback(() => {
    Keyboard.dismiss();
    setConfirmSheet(null);
  }, []);

  const handleAddUserSubtask = useCallback(async () => {
    if (!todo || todo.id.startsWith('local-')) return;
    if (!Array.isArray((todo as UserTodoPayload).subtasks)) return;
    const tt = newSubtaskTitle.trim();
    if (!tt) return;
    setSubtasksBusy(true);
    try {
      const created = await mfGoTodos.createUserTodoSubtask({ userTodoId: todo.id, title: tt });
      setSubtasksLocal((p) => [...p, created]);
      setNewSubtaskTitle('');
      onSubtasksChanged?.();
    } catch {
      snackbarService.error(t('home.todos.subtaskSaveFailed'));
    } finally {
      setSubtasksBusy(false);
    }
  }, [todo, newSubtaskTitle, onSubtasksChanged, t]);

  const handleToggleUserSubtask = useCallback(
    async (row: UserTodoSubtaskPayload) => {
      if (!todo || todo.id.startsWith('local-')) return;
      if (!Array.isArray((todo as UserTodoPayload).subtasks)) return;
      setSubtasksBusy(true);
      try {
        const updated = await mfGoTodos.updateUserTodoSubtask({
          id: row.id,
          completed: !row.completed,
        });
        setSubtasksLocal((p) => p.map((x) => (x.id === updated.id ? updated : x)));
        onSubtasksChanged?.();
      } catch {
        snackbarService.error(t('home.todos.subtaskSaveFailed'));
      } finally {
        setSubtasksBusy(false);
      }
    },
    [todo, onSubtasksChanged, t]
  );

  const handleDeleteUserSubtask = useCallback(
    async (subId: string) => {
      if (!todo || todo.id.startsWith('local-')) return;
      if (!Array.isArray((todo as UserTodoPayload).subtasks)) return;
      setSubtasksBusy(true);
      try {
        await mfGoTodos.deleteUserTodoSubtask(subId);
        setSubtasksLocal((p) => p.filter((x) => x.id !== subId));
        onSubtasksChanged?.();
      } catch {
        snackbarService.error(t('home.todos.subtaskSaveFailed'));
      } finally {
        setSubtasksBusy(false);
      }
    },
    [todo, onSubtasksChanged, t]
  );

  const handleDelete = async () => {
    if (!todo || !onDelete) return;
    setValidationError(null);
    setSubmitError(null);
    setIsDeleting(true);
    try {
      const apiError = await onDelete(todo.id);
      if (apiError) {
        setSubmitError(apiError);
      } else {
        onClose();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const canSave =
    title.trim().length > 0 &&
    title.trim().length <= TITLE_MAX &&
    !isBusy;

  if (!visible) return null;

  const confirmMessage =
    confirmSheet?.type === 'toPersonal'
      ? t('home.todos.moveToPersonalConfirm')
      : confirmSheet?.type === 'toOrg' && confirmSheet.orgName
        ? t('home.todos.moveToOrgConfirm', { orgName: confirmSheet.orgName })
        : '';

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.surfaceBackground,
      borderColor: colors.surfaceBorder,
      color: colors.bodyText,
    },
  ];

  return (
  <>
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={styles.sheetHost} pointerEvents="box-none">
          {/* Modal + KAV: avoid extra top offset (e.g. insets.top) — it over-shifts the sheet upward */}
          <AdaptiveKeyboardAvoidingView
            behavior="padding"
            keyboardVerticalOffset={0}
            style={styles.keyboardView}
          >
            <Pressable
              style={[
                styles.fullSheet,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.surfaceBorder,
                  maxHeight: Math.min(windowHeight * 0.92, windowHeight - insets.top - 8),
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                nestedScrollEnabled
                showsVerticalScrollIndicator
                style={[
                  styles.sheetScroll,
                  {
                    maxHeight: Math.min(windowHeight * 0.88, windowHeight - insets.top - 12),
                  },
                ]}
                contentContainerStyle={[
                  styles.sheetScrollContent,
                  { paddingBottom: insets.bottom + Sizing.padding.s },
                ]}
              >
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: colors.bodyText }]}>
                {isEdit ? t('home.todos.rename') : t('home.todos.add')}
              </Text>
              <Pressable
                onPress={onClose}
                disabled={isBusy}
                style={({ pressed }) => [
                  styles.closeButton,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                accessibilityLabel={t('common.close')}
                accessibilityRole="button"
              >
                <Ionicons name="close" size={22} color={colors.bodyText} />
              </Pressable>
            </View>

            <Text style={[styles.label, { color: colors.labelText }]}>
              {t('home.todos.iconLabel')}
            </Text>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.emojiRow}
            >
              {TODO_EMOJIS.map((e) => (
                <Pressable
                  key={e.emoji}
                  onPress={() => setSelectedEmoji(e.emoji)}
                  style={[
                    styles.emojiChip,
                    {
                      backgroundColor:
                        selectedEmoji === e.emoji
                          ? colors.tint + '25'
                          : colors.surfaceBackground,
                      borderColor:
                        selectedEmoji === e.emoji ? colors.tint : colors.surfaceBorder,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={styles.emojiText}>{e.emoji}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.label, { color: colors.labelText, marginTop: 8 }]}>
              {t('home.todos.titlePlaceholder')} *
            </Text>
            <TextInput
              {...textInputTheme}
              ref={titleInputRef}
              value={title}
              onChangeText={setTitle}
              placeholder={t('home.todos.titlePlaceholder')}
              maxLength={TITLE_MAX}
              style={inputStyle}
            />
            {title.length > 0 && (
              <Text style={[styles.hint, { color: colors.labelText }]}>
                {title.length}/{TITLE_MAX}
              </Text>
            )}

            {isEdit && (
              <Pressable
                onPress={() => setCompleted(!completed)}
                style={[
                  styles.checkboxRow,
                  { backgroundColor: colors.surfaceBackground, borderColor: colors.surfaceBorder },
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: completed ? colors.tint : colors.surfaceBorder,
                      backgroundColor: completed ? colors.tint : 'transparent',
                    },
                  ]}
                >
                  {completed && <Text style={[styles.checkmark, { color: onTint }]}>✓</Text>}
                </View>
                <Text style={[styles.checkboxLabel, { color: colors.bodyText }]}>
                  {t('home.todos.completed')}
                </Text>
              </Pressable>
            )}

            <View style={{ marginTop: 10 }}>
                <Text style={[styles.label, { color: colors.labelText }]}>
                  {t('home.todos.dueDateLabel')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Pressable
                    onPress={() => {
                      if (Platform.OS === 'android') {
                        setAndroidPendingDueDate(null);
                        setAndroidDuePickerStep('date');
                      } else {
                        setDuePickerExpanded((v) => !v);
                      }
                    }}
                    style={[
                      styles.pickerChip,
                      {
                        backgroundColor: colors.surfaceBackground,
                        borderColor: colors.surfaceBorder,
                        marginRight: 8,
                        marginBottom: 6,
                        maxWidth: '100%',
                      },
                    ]}
                  >
                    <Text style={[styles.pickerChipText, { color: colors.bodyText }]} numberOfLines={2}>
                      {dueAt ? formatDueLabel(dueAt) : t('home.todos.dueDateSet')}
                    </Text>
                  </Pressable>
                  {dueAt ? (
                    <Pressable
                      onPress={() => setDueAt(null)}
                      style={[
                        styles.pickerChip,
                        {
                          borderColor: colors.surfaceBorder,
                          backgroundColor: colors.surfaceBackground,
                          marginBottom: 6,
                        },
                      ]}
                    >
                      <Text style={[styles.pickerChipText, { color: colors.labelText }]}>
                        {t('home.todos.dueDateClear')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                {Platform.OS === 'ios' && duePickerExpanded && (
                  <DateTimePicker
                    value={dueAt ?? new Date()}
                    mode="datetime"
                    display="inline"
                    themeVariant={isDark ? 'dark' : 'light'}
                    onChange={(_, selected) => {
                      if (selected) setDueAt(selected);
                    }}
                  />
                )}
                {Platform.OS === 'android' && androidDuePickerStep === 'date' && (
                  <DateTimePicker
                    value={dueAt ?? new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, selected) => {
                      if (event.type !== 'set' || !selected) {
                        setAndroidDuePickerStep(null);
                        setAndroidPendingDueDate(null);
                        return;
                      }
                      const timeSource = dueAt ?? new Date();
                      setAndroidPendingDueDate(mergeDateWithTimeOfDay(selected, timeSource));
                      setAndroidDuePickerStep('time');
                    }}
                  />
                )}
                {Platform.OS === 'android' &&
                  androidDuePickerStep === 'time' &&
                  androidPendingDueDate && (
                    <DateTimePicker
                      value={androidPendingDueDate}
                      mode="time"
                      display="default"
                      onChange={(event, selected) => {
                        const pending = androidPendingDueDate;
                        setAndroidDuePickerStep(null);
                        setAndroidPendingDueDate(null);
                        if (event.type !== 'set' || !selected || !pending) return;
                        setDueAt(mergeDateWithTimeOfDay(pending, selected));
                      }}
                    />
                  )}
              </View>

            {showUserSubtasks ? (
              <View style={{ marginTop: 14 }}>
                <Text style={[styles.label, { color: colors.labelText }]}>
                  {t('home.todos.subtasksSection')}
                </Text>
                {subtasksLocal.map((st) => (
                  <View
                    key={st.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 8,
                      paddingVertical: 6,
                      paddingHorizontal: 8,
                      borderRadius: 10,
                      backgroundColor: colors.surfaceBackground,
                      borderWidth: 1,
                      borderColor: colors.surfaceBorder,
                    }}
                  >
                    <Pressable
                      onPress={() => void handleToggleUserSubtask(st)}
                      disabled={subtasksBusy}
                      hitSlop={6}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: st.completed }}
                    >
                      <Ionicons
                        name={st.completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={st.completed ? (colors.successColor ?? '#34C759') : colors.icon}
                      />
                    </Pressable>
                    <Text
                      style={{
                        flex: 1,
                        color: colors.bodyText,
                        fontSize: 15,
                        textDecorationLine: st.completed ? 'line-through' : 'none',
                        opacity: st.completed ? 0.65 : 1,
                      }}
                    >
                      {st.title}
                    </Text>
                    <Pressable
                      onPress={() => void handleDeleteUserSubtask(st.id)}
                      disabled={subtasksBusy}
                      hitSlop={8}
                      accessibilityLabel={t('home.todos.subtaskDeleteA11y')}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.icon} />
                    </Pressable>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <TextInput
                    {...textInputTheme}
                    value={newSubtaskTitle}
                    onChangeText={setNewSubtaskTitle}
                    placeholder={t('home.todos.subtaskPlaceholder')}
                    maxLength={TITLE_MAX}
                    editable={!subtasksBusy}
                    style={[inputStyle, { flex: 1, marginBottom: 0 }]}
                  />
                  <TouchableOpacity
                    onPress={() => void handleAddUserSubtask()}
                    disabled={subtasksBusy || !newSubtaskTitle.trim()}
                    activeOpacity={0.85}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor:
                        subtasksBusy || !newSubtaskTitle.trim()
                          ? colors.surfaceBorder
                          : colors.tint,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          subtasksBusy || !newSubtaskTitle.trim()
                            ? colors.labelText
                            : onTint,
                        fontWeight: '600',
                        fontSize: 14,
                      }}
                    >
                      {t('home.todos.subtaskAdd')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {(organizations.length > 0 || showFixedProjectContextStrip) && (
              <>
                {showFixedProjectContextStrip ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={[styles.label, { color: colors.labelText }]}>
                      {t('profile.organizations.projects.todoSheetContext')}
                    </Text>
                    <Text style={[styles.hint, { color: colors.bodyText, fontSize: 15, marginTop: 4 }]}>
                      {isFixedProjectSheet
                        ? (fixedOrgMeta?.name ?? '—') + ' · ' + (fixedProjectName?.trim() || '—')
                        : organizationProjectEditLock
                          ? organizationProjectEditLock.organizationName.trim() +
                            ' · ' +
                            (organizationProjectEditLock.projectName.trim() || '—')
                          : '—'}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.label, { color: colors.labelText, marginTop: 8 }]}>
                      {t('home.todos.organization')}
                    </Text>
                    <ScrollView
                      horizontal
                      nestedScrollEnabled
                      showsHorizontalScrollIndicator={false}
                      style={styles.pickerRow}
                      keyboardShouldPersistTaps="handled"
                    >
                      <TouchableOpacity
                        onPress={handleSelectPersonal}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={[
                          styles.pickerChip,
                          styles.pickerChipWithIcon,
                          {
                            backgroundColor: !organizationID ? colors.tint : colors.surfaceBackground,
                            borderColor: colors.surfaceBorder,
                          },
                        ]}
                      >
                        {!organizationID && (
                          <Ionicons
                            name="home"
                            size={15}
                            color={onTint}
                            style={{ marginRight: 6 }}
                          />
                        )}
                        <Text
                          style={[
                            styles.pickerChipText,
                            { color: !organizationID ? onTint : colors.bodyText },
                          ]}
                        >
                          {t('home.todos.personal')}
                        </Text>
                      </TouchableOpacity>
                      {organizations.map((org) => (
                        <TouchableOpacity
                          key={org.id}
                          onPress={() => handleSelectOrg(org)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={[
                            styles.pickerChip,
                            {
                              backgroundColor:
                                organizationID === org.id ? colors.tint : colors.surfaceBackground,
                              borderColor: colors.surfaceBorder,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.pickerChipText,
                              { color: organizationID === org.id ? onTint : colors.bodyText },
                            ]}
                            numberOfLines={1}
                          >
                            {org.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {organizationID && !isEdit && (
                      <>
                        <Text style={[styles.label, { color: colors.labelText, marginTop: 8 }]}>
                          {t('home.todos.projectScope')}
                        </Text>
                        {orgProjectsLoading ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.tint}
                            style={{ marginVertical: 8 }}
                          />
                        ) : (
                          <ScrollView
                            horizontal
                            nestedScrollEnabled
                            showsHorizontalScrollIndicator={false}
                            style={styles.pickerRow}
                            keyboardShouldPersistTaps="handled"
                          >
                            <TouchableOpacity
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setOrganizationProjectId(null);
                                setAssignedToUserID(
                                  !isEdit && currentUserId ? currentUserId : null
                                );
                              }}
                              activeOpacity={0.7}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={[
                                styles.pickerChip,
                                {
                                  backgroundColor: !organizationProjectId
                                    ? colors.tint
                                    : colors.surfaceBackground,
                                  borderColor: colors.surfaceBorder,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.pickerChipText,
                                  {
                                    color: !organizationProjectId ? onTint : colors.bodyText,
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {t('home.todos.orgGeneralList')}
                              </Text>
                            </TouchableOpacity>
                            {orgProjects.map((p) => (
                              <TouchableOpacity
                                key={p.id}
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  setOrganizationProjectId(p.id);
                                  setAssignedToUserID(null);
                                }}
                                activeOpacity={0.7}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={[
                                  styles.pickerChip,
                                  {
                                    backgroundColor:
                                      organizationProjectId === p.id
                                        ? colors.tint
                                        : colors.surfaceBackground,
                                    borderColor: colors.surfaceBorder,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.pickerChipText,
                                    {
                                      color:
                                        organizationProjectId === p.id ? onTint : colors.bodyText,
                                    },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {p.name}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        )}
                      </>
                    )}
                  </>
                )}

                {organizationID &&
                  organizationProjectId &&
                  !isEdit &&
                  isOrgAdminOrOwner &&
                  !isLockedProjectTodoEdit && (
                  <>
                    <Text style={[styles.label, { color: colors.labelText, marginTop: 6 }]}>
                      {t('home.todos.assignTo')}
                    </Text>
                    {projectMembersLoading ? (
                      <ActivityIndicator size="small" color={colors.tint} style={{ marginVertical: 4 }} />
                    ) : (
                      <>
                        <ScrollView
                          horizontal
                          nestedScrollEnabled
                          showsHorizontalScrollIndicator={false}
                          style={styles.pickerRow}
                          keyboardShouldPersistTaps="handled"
                        >
                          <Pressable
                            onPress={() => setAssignedToUserID(null)}
                            style={[
                              styles.pickerChip,
                              {
                                backgroundColor: !assignedToUserID
                                  ? colors.tint
                                  : colors.surfaceBackground,
                                borderColor: colors.surfaceBorder,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.pickerChipText,
                                { color: !assignedToUserID ? onTint : colors.bodyText },
                              ]}
                            >
                              {t('home.todos.unassigned')}
                            </Text>
                          </Pressable>
                          {projectMembers.map((m) => (
                            <Pressable
                              key={m.id}
                              onPress={() => setAssignedToUserID(m.userId)}
                              style={[
                                styles.pickerChip,
                                {
                                  backgroundColor:
                                    assignedToUserID === m.userId
                                      ? colors.tint
                                      : colors.surfaceBackground,
                                  borderColor: colors.surfaceBorder,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.pickerChipText,
                                  {
                                    color:
                                      assignedToUserID === m.userId ? onTint : colors.bodyText,
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {m.userNickname || `@${m.userId.slice(0, 8)}…`}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                        {projectMembers.length === 0 && (
                          <Text style={[styles.hint, { color: colors.labelText, marginTop: 4 }]}>
                            {t('home.todos.assignMembersEmpty')}
                          </Text>
                        )}
                      </>
                    )}
                  </>
                )}

                {organizationID &&
                  (isEdit || !organizationProjectId) &&
                  !isLockedProjectTodoEdit && (
                  <>
                    <Text style={[styles.label, { color: colors.labelText, marginTop: 6 }]}>
                      {t('home.todos.assignTo')}
                    </Text>
                    {isOrgGeneralCreate ? (
                      <View style={styles.pickerRow}>
                        <View
                          style={[
                            styles.pickerChip,
                            {
                              backgroundColor: colors.tint,
                              borderColor: colors.surfaceBorder,
                            },
                          ]}
                          accessibilityRole="text"
                        >
                          <Text style={[styles.pickerChipText, { color: onTint }]}>
                            {t('profile.organizations.projects.todosFilterMine')}
                          </Text>
                        </View>
                      </View>
                    ) : membersLoading ? (
                      <ActivityIndicator size="small" color={colors.tint} style={{ marginVertical: 4 }} />
                    ) : (
                      <>
                        <ScrollView
                          horizontal
                          nestedScrollEnabled
                          showsHorizontalScrollIndicator={false}
                          style={styles.pickerRow}
                          keyboardShouldPersistTaps="handled"
                        >
                          <Pressable
                            onPress={() => setAssignedToUserID(null)}
                            style={[
                              styles.pickerChip,
                              {
                                backgroundColor: !assignedToUserID
                                  ? colors.tint
                                  : colors.surfaceBackground,
                                borderColor: colors.surfaceBorder,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.pickerChipText,
                                { color: !assignedToUserID ? onTint : colors.bodyText },
                              ]}
                            >
                              {t('home.todos.unassigned')}
                            </Text>
                          </Pressable>
                          {members.map((m) => (
                            <Pressable
                              key={m.id}
                              onPress={() => setAssignedToUserID(m.userID)}
                              style={[
                                styles.pickerChip,
                                {
                                  backgroundColor:
                                    assignedToUserID === m.userID
                                      ? colors.tint
                                      : colors.surfaceBackground,
                                  borderColor: colors.surfaceBorder,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.pickerChipText,
                                  {
                                    color: assignedToUserID === m.userID ? onTint : colors.bodyText,
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {m.userNickname || `@${m.userID.slice(0, 8)}…`}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                        {members.length === 0 && (
                          <Text style={[styles.hint, { color: colors.labelText, marginTop: 4 }]}>
                            {t('home.todos.assignMembersEmpty')}
                          </Text>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {(validationError || submitError) && (
              <Text
                style={[styles.errorText, { color: colors.errorColor || '#FF3B30' }]}
              >
                {validationError || submitError}
              </Text>
            )}

            <View style={styles.buttonRow}>
              {isEdit && onDelete && (
                <Pressable
                  onPress={handleDelete}
                  disabled={isBusy}
                  style={({ pressed }) => [
                    styles.deleteButton,
                    {
                      backgroundColor: colors.surfaceBackground,
                      borderColor: colors.surfaceBorder,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  {isDeleting ? (
                    <ActivityIndicator color={colors.errorColor || '#FF3B30'} />
                  ) : (
                    <Text style={[styles.deleteButtonText, { color: colors.errorColor || '#FF3B30' }]}>
                      {t('common.delete')}
                    </Text>
                  )}
                </Pressable>
              )}
              <Pressable
                onPress={handleSave}
                disabled={!canSave || isBusy}
                style={({ pressed }) => [
                  styles.saveButton,
                  {
                    backgroundColor: canSave && !isBusy ? colors.tint : colors.surfaceBorder,
                    opacity: pressed ? 0.9 : 1,
                  },
                  (!canSave || isBusy) && styles.saveButtonDisabled,
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text
                    style={[
                      styles.saveButtonText,
                      {
                        color: canSave && !isBusy ? onTint : colors.labelText,
                      },
                    ]}
                  >
                    {t('common.save')}
                  </Text>
                )}
              </Pressable>
            </View>
            </ScrollView>
            </Pressable>
          </AdaptiveKeyboardAvoidingView>
        </View>

        {confirmSheet && (
          <View style={styles.confirmOverlay} pointerEvents="box-none">
            <Pressable
              style={styles.confirmOverlayBackdrop}
              onPress={handleConfirmSheetCancel}
            />
            <Pressable
              style={[
                styles.confirmSheet,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.surfaceBorder,
                  paddingBottom: insets.bottom + Sizing.padding.s,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.handle} />
              <Text style={[styles.confirmSheetTitle, { color: colors.bodyText }]}>
                {confirmSheet.type === 'toPersonal'
                  ? t('home.todos.personal')
                  : t('home.todos.organization')}
              </Text>
              <Text style={[styles.confirmSheetMessage, { color: colors.labelText }]}>
                {confirmMessage}
              </Text>
              <View style={styles.confirmSheetButtons}>
                <Pressable
                  onPress={handleConfirmSheetCancel}
                  style={[
                    styles.confirmSheetButton,
                    styles.confirmSheetButtonSecondary,
                    { backgroundColor: colors.surfaceBackground, borderColor: colors.surfaceBorder },
                  ]}
                >
                  <Text style={[styles.confirmSheetButtonText, { color: colors.bodyText }]}>
                    {t('common.cancel')}
                  </Text>
                </Pressable>
                <TouchableOpacity
                  onPress={handleConfirmSheetConfirm}
                  activeOpacity={0.8}
                  style={[
                    styles.confirmSheetButton,
                    styles.confirmSheetButtonPrimary,
                    { backgroundColor: colors.tint },
                  ]}
                >
                  <Text style={[styles.confirmSheetButtonTextPrimary, { color: onTint }]}>
                    {t('common.ok')}
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  </>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetHost: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  keyboardView: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  /**
   * Bottom sheet: width only here — maxHeight is set inline from window + safe area so the
   * panel never extends under the status bar. No minHeight: avoids forcing a tall empty shell
   * that interacts badly with KeyboardAvoidingView (content looking “pushed off” the top).
   */
  fullSheet: {
    width: '100%',
    alignSelf: 'flex-end',
    flexShrink: 1,
    borderTopLeftRadius: Sizing.modal.sheetTopCornerRadius,
    borderTopRightRadius: Sizing.modal.sheetTopCornerRadius,
    borderBottomLeftRadius: Sizing.modal.sheetBottomCornerRadius,
    borderBottomRightRadius: Sizing.modal.sheetBottomCornerRadius,
    paddingHorizontal: Sizing.padding.l,
    paddingTop: Sizing.padding.s,
    borderTopWidth: 1,
  },
  sheetScroll: {
    width: '100%',
  },
  /** Do not use flexGrow: 1 — it stretches short content and wastes vertical space. */
  sheetScrollContent: {
    flexGrow: 0,
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 1000,
    elevation: 1000,
  },
  confirmOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  handle: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.4)',
    alignSelf: 'center',
    marginBottom: Sizing.padding.s,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Sizing.padding.s,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    flex: 1,
  },
  closeButton: {
    padding: Sizing.padding.xs,
    marginRight: -Sizing.padding.xs,
    marginLeft: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Sizing.padding.m,
    paddingVertical: Sizing.padding.s,
    fontSize: 15,
    minHeight: 44,
  },
  hint: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 2,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Sizing.padding.s,
    paddingHorizontal: Sizing.padding.m,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: Sizing.padding.s,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 12,
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: 15,
  },
  errorText: {
    fontSize: 13,
    marginBottom: Sizing.padding.s,
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Sizing.padding.m,
  },
  saveButton: {
    flex: 1,
    paddingVertical: Sizing.padding.s + 2,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    paddingVertical: Sizing.padding.s + 2,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  pickerChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  pickerChipWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emojiRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 2,
  },
  emojiChip: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 20,
  },
  confirmSheet: {
    borderTopLeftRadius: Sizing.modal.sheetTopCornerRadius,
    borderTopRightRadius: Sizing.modal.sheetTopCornerRadius,
    borderBottomLeftRadius: Sizing.modal.sheetBottomCornerRadius,
    borderBottomRightRadius: Sizing.modal.sheetBottomCornerRadius,
    paddingHorizontal: Sizing.padding.l,
    paddingTop: Sizing.padding.s,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  confirmSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  confirmSheetMessage: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 16,
  },
  confirmSheetButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmSheetButton: {
    flex: 1,
    paddingVertical: Sizing.padding.s + 2,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmSheetButtonSecondary: {
    borderWidth: 1,
  },
  confirmSheetButtonPrimary: {},
  confirmSheetButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmSheetButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
  },
});
