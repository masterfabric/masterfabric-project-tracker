import { ThemedText } from '@/src/shared/components/ThemedText';
import { useLocale } from '@/src/shared/hooks/use-locale';
import {
  mfGoOrganizations,
  type UserTodoPayload,
  type OrganizationPayload,
  type OrganizationProjectPayload,
  type OrganizationProjectTodoPayload,
  type OrganizationMemberPayload,
} from '@/src/shared/services/mf-go-api';
import type { LocalTodoPayload } from '@/src/shared/services/local-todos-service';
import { snackbarService } from '@/src/shared/services/snackbar-service';
import {
  projectTodoToReminderPayload,
  syncTodoRemindersFromList,
} from '@/src/shared/services/todo-reminders-service';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { t } from '@/src/shared/i18n';
import {
  SOFT_CARD_RADIUS,
  softSurfaceShadow,
} from '@/src/shared/ui/screen-card-styles';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import DraggableFlatList, {
  ShadowDecorator,
  ScaleDecorator,
  type DragEndParams,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { parseTodoTitle } from '../../constants/todo-emojis';
import { TodosListSkeleton } from '../skeletons/todos-list-skeleton';
import { todosSectionStyles } from '../../styles/todos-section.styles';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MAX_VISIBLE = 7;

type TodoItemType = UserTodoPayload | LocalTodoPayload;

function organizationDisplayName(orgName: string | null, organizationID: string): string {
  if (orgName?.trim()) return orgName.trim();
  return organizationID.length <= 14 ? organizationID : `${organizationID.slice(0, 12)}…`;
}

interface TodosSectionProps {
  todos: TodoItemType[];
  organizations: OrganizationPayload[];
  assignedUserNames: Record<string, string>;
  isLoading: boolean;
  /** Pass `true` to show loading skeleton (same as org news refresh). */
  onRefresh: (showSkeleton?: boolean) => void;
  onAddTodo: () => void;
  onEditTodo: (todo: TodoItemType) => void;
  onToggleComplete: (todo: TodoItemType) => void;
  onReorderTodos: (ordered: TodoItemType[]) => void;
  /** Called when todo reorder drag starts / ends (end includes cancel). Parent can disable outer scroll. */
  onReorderDragActiveChange?: (dragging: boolean) => void;
  /** Signed-in user id (for “me” assignee filter). */
  currentUserId?: string | null;
  /** When true, show org / project / assignee filter rows (requires org memberships). */
  projectFiltersEnabled?: boolean;
  /** Increment when home refocuses or refreshes so project todo list matches org project screen. */
  projectTodosSyncKey?: number;
  /** Long-press on a project-filtered row opens edit (TodoSheet) from home. */
  onEditProjectTodo?: (payload: {
    todo: OrganizationProjectTodoPayload;
    organizationId: string;
    projectId: string;
    organizationName: string;
    projectName: string;
  }) => void;
}

interface TodoRowProps {
  todo: TodoItemType;
  orgName: string | null;
  assignedDisplay: string;
  isDark: boolean;
  colors: ReturnType<typeof getThemeColors>;
  onEdit: (todo: TodoItemType) => void;
  onToggle: (todo: TodoItemType) => void;
  onDragHandleLongPress: () => void;
  isDragging: boolean;
  /** When true, hide reorder handle (filtered / project list). */
  dragDisabled?: boolean;
}

const TodoRow = React.memo(function TodoRow({
  todo,
  orgName,
  assignedDisplay,
  isDark,
  colors,
  onEdit,
  onToggle,
  onDragHandleLongPress,
  isDragging,
  dragDisabled,
}: TodoRowProps) {
  const { locale } = useLocale();
  const { emoji, text } = parseTodoTitle(todo.title);
  const dueLine = useMemo(() => {
    if (!('dueAt' in todo) || !todo.dueAt) return null;
    const d = new Date(todo.dueAt);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d);
  }, [todo, locale]);
  const handleEdit = useCallback(() => onEdit(todo), [onEdit, todo]);
  const handleToggleContent = useCallback(() => onToggle(todo), [onToggle, todo]);
  const handleToggle = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onToggle(todo);
    },
    [onToggle, todo]
  );

  const itemStyle = useMemo(
    () => [
      todosSectionStyles.todoItem,
      {
        backgroundColor: isDark ? colors.inputBackground : '#fff',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.surfaceBorder + '70',
        opacity: isDragging ? 0.96 : 1,
      },
    ],
    [isDark, colors.background, colors.surfaceBorder, isDragging]
  );

  const orgA11y =
    todo.organizationID != null && todo.organizationID !== ''
      ? `${t('home.todos.organization')}: ${organizationDisplayName(orgName, todo.organizationID)}`
      : '';
  const assignA11y = todo.assignedToUserID
    ? `${t('home.todos.assignedTo')}: ${assignedDisplay}`
    : '';
  const dueA11y = dueLine ? `${t('home.todos.dueDateLabel')}: ${dueLine}` : '';
  const metaA11y = [orgA11y, assignA11y, dueA11y].filter(Boolean).join('. ');

  return (
    <View style={itemStyle}>
      <Pressable
        onPress={handleToggle}
        hitSlop={6}
        accessibilityRole="button"
        style={todosSectionStyles.todoCheckboxWrap}
      >
        <Ionicons
          name={todo.completed ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={todo.completed ? colors.tint : colors.labelText}
        />
      </Pressable>
      <View style={todosSectionStyles.emojiPrefix}>
        <Text style={todosSectionStyles.emojiText}>{emoji}</Text>
      </View>
      <Pressable
        onPress={handleToggleContent}
        onLongPress={handleEdit}
        delayLongPress={400}
        style={todosSectionStyles.todoItemContent}
      >
        <ThemedText
          type="default"
          style={[
            todosSectionStyles.todoTitle,
            { color: colors.bodyText },
            todo.completed && todosSectionStyles.todoTitleCompleted,
          ]}
          numberOfLines={2}
        >
          {text || todo.title}
        </ThemedText>
        {(todo.organizationID || todo.assignedToUserID || dueLine) ? (
          <View
            style={todosSectionStyles.todoMetaColumn}
            accessible
            accessibilityLabel={metaA11y || undefined}
          >
            {todo.organizationID ? (
              <View style={todosSectionStyles.todoMetaRow}>
                <Ionicons
                  name="business-outline"
                  size={15}
                  color={colors.labelText}
                  style={todosSectionStyles.todoMetaIcon}
                />
                <Text
                  style={[todosSectionStyles.todoMetaValue, { color: colors.bodyText }]}
                  numberOfLines={1}
                >
                  {organizationDisplayName(orgName, todo.organizationID)}
                </Text>
              </View>
            ) : null}
            {todo.assignedToUserID ? (
              <View style={todosSectionStyles.todoMetaRow}>
                <Ionicons
                  name="person-outline"
                  size={15}
                  color={colors.labelText}
                  style={todosSectionStyles.todoMetaIcon}
                />
                <Text
                  style={[todosSectionStyles.todoMetaValue, { color: colors.bodyText }]}
                  numberOfLines={1}
                >
                  {assignedDisplay}
                </Text>
              </View>
            ) : null}
            {dueLine ? (
              <View style={todosSectionStyles.todoMetaRow}>
                <Ionicons
                  name="calendar-outline"
                  size={15}
                  color={colors.labelText}
                  style={todosSectionStyles.todoMetaIcon}
                />
                <Text
                  style={[todosSectionStyles.todoMetaValue, { color: colors.bodyText }]}
                  numberOfLines={1}
                >
                  {dueLine}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </Pressable>
      {dragDisabled ? (
        <View style={[todosSectionStyles.dragHandle, { opacity: 0 }]} accessibilityElementsHidden />
      ) : (
        <Pressable
          onLongPress={onDragHandleLongPress}
          delayLongPress={180}
          style={todosSectionStyles.dragHandle}
          accessibilityRole="button"
          accessibilityLabel={t('home.todos.reorderHint')}
        >
          <Ionicons name="reorder-three-outline" size={22} color={colors.labelText} />
        </Pressable>
      )}
    </View>
  );
});

type HomeListEntry =
  | { kind: 'user'; todo: TodoItemType }
  | {
      kind: 'project';
      todo: OrganizationProjectTodoPayload;
      projectId: string;
      organizationId: string;
      projectName: string;
      orgName: string | null;
    };

type AssigneeFilterId = 'all' | 'unassigned' | 'me' | string;

function matchesAssigneeUserTodo(
  todo: TodoItemType,
  filter: AssigneeFilterId,
  currentUserId: string | null | undefined
): boolean {
  if (filter === 'all') return true;
  const aid = todo.assignedToUserID ?? null;
  if (filter === 'unassigned') return !aid;
  if (filter === 'me') return !!currentUserId && aid === currentUserId;
  return aid === filter;
}

function matchesAssigneeProjectTodo(
  todo: OrganizationProjectTodoPayload,
  filter: AssigneeFilterId,
  currentUserId: string | null | undefined
): boolean {
  if (filter === 'all') return true;
  const aid = todo.assignedToUserId ?? null;
  if (filter === 'unassigned') return !aid;
  if (filter === 'me') return !!currentUserId && aid === currentUserId;
  return aid === filter;
}

interface ProjectTodoRowProps {
  entry: Extract<HomeListEntry, { kind: 'project' }>;
  isDark: boolean;
  colors: ReturnType<typeof getThemeColors>;
  assignedDisplay: string;
  onToggle: (todo: OrganizationProjectTodoPayload) => void;
  onLongPressEdit?: () => void;
}

const ProjectTodoRow = React.memo(function ProjectTodoRow({
  entry,
  isDark,
  colors,
  assignedDisplay,
  onToggle,
  onLongPressEdit,
}: ProjectTodoRowProps) {
  const { locale } = useLocale();
  const { emoji, text } = parseTodoTitle(entry.todo.title);
  const completed = entry.todo.status === 'DONE';
  const dueLine = useMemo(() => {
    if (!entry.todo.dueAt) return null;
    const d = new Date(entry.todo.dueAt);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d);
  }, [entry.todo.dueAt, locale]);
  const handleToggle = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onToggle(entry.todo);
    },
    [onToggle, entry.todo]
  );
  const handleToggleContent = useCallback(() => onToggle(entry.todo), [onToggle, entry.todo]);

  const cardStyle = useMemo(
    () => [
      todosSectionStyles.projectTodoCard,
      {
        backgroundColor: isDark ? colors.inputBackground : '#fff',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.surfaceBorder + '70',
      },
    ],
    [isDark, colors.inputBackground, colors.surfaceBorder]
  );

  const metaA11y = [
    entry.todo.assignedToUserId
      ? `${t('home.todos.assignedTo')}: ${assignedDisplay}`
      : '',
    dueLine ? `${t('home.todos.dueDateLabel')}: ${dueLine}` : '',
  ]
    .filter(Boolean)
    .join('. ');

  const subtasksList = Array.isArray(entry.todo.subtasks) ? entry.todo.subtasks : [];
  const subtasksPreview = subtasksList.slice(0, 2);
  const hasMoreSubtasks = subtasksList.length > 2;
  const sectionHeaderColor = isDark ? '#EBEBF5' : '#6D6D70';

  const successTone = colors.successColor ?? '#34C759';

  return (
    <View style={cardStyle}>
      <View style={todosSectionStyles.projectTodoMainRow}>
        <Pressable
          onPress={handleToggle}
          hitSlop={6}
          accessibilityRole="button"
          style={todosSectionStyles.todoCheckboxWrap}
        >
          <Ionicons
            name={completed ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={completed ? colors.tint : colors.labelText}
          />
        </Pressable>
        <View style={todosSectionStyles.emojiPrefix}>
          <Text style={todosSectionStyles.emojiText}>{emoji}</Text>
        </View>
        <Pressable
          onPress={handleToggleContent}
          onLongPress={() => onLongPressEdit?.()}
          delayLongPress={400}
          style={[todosSectionStyles.todoItemContent, { flex: 1 }]}
        >
          <ThemedText
            type="default"
            style={[
              todosSectionStyles.todoTitle,
              { color: colors.bodyText },
              completed && todosSectionStyles.todoTitleCompleted,
            ]}
            numberOfLines={2}
          >
            {text || entry.todo.title}
          </ThemedText>
          {entry.todo.assignedToUserId || dueLine ? (
            <View
              style={todosSectionStyles.todoMetaColumn}
              accessible
              accessibilityLabel={metaA11y || undefined}
            >
              {entry.todo.assignedToUserId ? (
                <View style={todosSectionStyles.todoMetaRow}>
                  <Ionicons
                    name="person-outline"
                    size={15}
                    color={colors.labelText}
                    style={todosSectionStyles.todoMetaIcon}
                  />
                  <Text
                    style={[todosSectionStyles.todoMetaValue, { color: colors.bodyText }]}
                    numberOfLines={1}
                  >
                    {assignedDisplay}
                  </Text>
                </View>
              ) : null}
              {dueLine ? (
                <View style={todosSectionStyles.todoMetaRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={15}
                    color={colors.labelText}
                    style={todosSectionStyles.todoMetaIcon}
                  />
                  <Text
                    style={[todosSectionStyles.todoMetaValue, { color: colors.bodyText }]}
                    numberOfLines={1}
                  >
                    {dueLine}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </Pressable>
        <View style={[todosSectionStyles.dragHandle, { opacity: 0 }]} accessibilityElementsHidden />
      </View>

      {subtasksPreview.length > 0 ? (
        <View style={todosSectionStyles.projectTodoSubtasksPreview} pointerEvents="box-none">
          <Text
            style={[
              todosSectionStyles.projectTodoSubtasksPreviewLabel,
              { color: sectionHeaderColor },
            ]}
          >
            {t('home.todos.subtasksSection')}
          </Text>
          {subtasksPreview.map((st) => (
            <View key={st.id} style={todosSectionStyles.projectTodoSubtaskPreviewRow}>
              <Ionicons
                name={st.completed ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={st.completed ? successTone : colors.icon}
                style={{ marginTop: 1 }}
              />
              <Text
                style={[
                  todosSectionStyles.projectTodoSubtaskPreviewText,
                  {
                    color: colors.bodyText,
                    textDecorationLine: st.completed ? 'line-through' : 'none',
                    opacity: st.completed ? 0.65 : 1,
                  },
                ]}
              >
                {st.title}
              </Text>
            </View>
          ))}
          {hasMoreSubtasks ? (
            <Text style={{ fontSize: 12, color: colors.labelText, marginTop: 2 }}>
              {t('home.todos.subtasksPreviewMoreHint')}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

export const TodosSection = React.memo(function TodosSection({
  todos,
  organizations,
  assignedUserNames,
  isLoading,
  onRefresh,
  onAddTodo,
  onEditTodo,
  onToggleComplete,
  onReorderTodos,
  onReorderDragActiveChange,
  currentUserId,
  projectFiltersEnabled = false,
  projectTodosSyncKey = 0,
  onEditProjectTodo,
}: TodosSectionProps) {
  useLocale();

  useEffect(() => {
    return () => onReorderDragActiveChange?.(false);
  }, [onReorderDragActiveChange]);
  const { isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const orgFilterChipMaxWidth = Math.min(200, Math.round(windowWidth * 0.45));
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const [isExpanded, setIsExpanded] = useState(false);
  const [filterOrg, setFilterOrg] = useState<'all' | 'personal' | string>('all');
  const [filterProject, setFilterProject] = useState<'general' | string>('general');
  const [filterAssignee, setFilterAssignee] = useState<AssigneeFilterId>('all');
  const [orgProjects, setOrgProjects] = useState<OrganizationProjectPayload[]>([]);
  const [orgProjectsLoading, setOrgProjectsLoading] = useState(false);
  const [orgMembersForFilter, setOrgMembersForFilter] = useState<OrganizationMemberPayload[]>([]);
  const [projectTodos, setProjectTodos] = useState<OrganizationProjectTodoPayload[]>([]);
  const [projectTodosLoading, setProjectTodosLoading] = useState(false);

  useEffect(() => {
    if (!projectFiltersEnabled) {
      setFilterOrg('all');
      setFilterProject('general');
      setFilterAssignee('all');
      setOrgProjects([]);
      setOrgMembersForFilter([]);
      setProjectTodos([]);
    }
  }, [projectFiltersEnabled]);

  useEffect(() => {
    if (!projectFiltersEnabled || filterOrg === 'all' || filterOrg === 'personal') {
      setOrgProjects([]);
      setOrgMembersForFilter([]);
      return;
    }
    let cancelled = false;
    setOrgProjectsLoading(true);
    Promise.all([
      mfGoOrganizations.organizationProjects(filterOrg),
      mfGoOrganizations.organizationMembers(filterOrg),
    ])
      .then(([projs, mems]) => {
        if (cancelled) return;
        setOrgProjects(projs);
        setOrgMembersForFilter(
          mems.filter((m) => m.membershipStatus === 'ACTIVE')
        );
      })
      .catch(() => {
        if (!cancelled) {
          setOrgProjects([]);
          setOrgMembersForFilter([]);
        }
      })
      .finally(() => {
        if (!cancelled) setOrgProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectFiltersEnabled, filterOrg]);

  useEffect(() => {
    if (
      !projectFiltersEnabled ||
      filterOrg === 'all' ||
      filterOrg === 'personal' ||
      filterProject === 'general'
    ) {
      setProjectTodos([]);
      return;
    }
    let cancelled = false;
    setProjectTodosLoading(true);
    mfGoOrganizations
      .organizationProjectTodos(filterProject)
      .then((rows) => {
        if (!cancelled) setProjectTodos(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setProjectTodos([]);
          snackbarService.error(t('home.todos.listFilterProjectTodosError'));
        }
      })
      .finally(() => {
        if (!cancelled) setProjectTodosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectFiltersEnabled, filterOrg, filterProject, projectTodosSyncKey, t]);

  const viewingProjectTodos =
    projectFiltersEnabled &&
    filterOrg !== 'all' &&
    filterOrg !== 'personal' &&
    filterProject !== 'general';

  useEffect(() => {
    if (!viewingProjectTodos || projectTodos.length === 0) return;
    void syncTodoRemindersFromList(projectTodos.map(projectTodoToReminderPayload));
  }, [viewingProjectTodos, projectTodos]);

  useEffect(() => {
    if (filterOrg === 'personal' && filterAssignee === 'unassigned') {
      setFilterAssignee('all');
    }
  }, [filterOrg, filterAssignee]);

  /** "Assigned to me" chip already filters by self; drop current user from org member chips. */
  const orgMembersForAssigneeChips = useMemo(() => {
    if (!currentUserId) return orgMembersForFilter;
    return orgMembersForFilter.filter((m) => m.userID !== currentUserId);
  }, [orgMembersForFilter, currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    if (filterOrg === 'all' || filterOrg === 'personal') return;
    if (filterAssignee === currentUserId) {
      setFilterAssignee('me');
    }
  }, [currentUserId, filterOrg, filterAssignee]);

  const selectOrg = useCallback((next: 'all' | 'personal' | string) => {
    void Haptics.selectionAsync();
    setFilterOrg(next);
    setFilterProject('general');
    setFilterAssignee('all');
  }, []);

  const selectProject = useCallback((next: 'general' | string) => {
    void Haptics.selectionAsync();
    setFilterProject(next);
  }, []);

  const selectAssignee = useCallback((next: AssigneeFilterId) => {
    void Haptics.selectionAsync();
    setFilterAssignee(next);
  }, []);

  const openProjectScreenWithAssigneeFilter = useCallback(
    (assignee: AssigneeFilterId) => {
      if (!viewingProjectTodos) return;
      if (filterOrg === 'all' || filterOrg === 'personal') return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const enc = encodeURIComponent(assignee);
      router.push(
        `/organization/${filterOrg}/project/${filterProject}?assignee=${enc}` as never
      );
    },
    [viewingProjectTodos, filterOrg, filterProject]
  );

  const reorderEnabled =
    !projectFiltersEnabled || (filterOrg === 'all' && filterAssignee === 'all' && !viewingProjectTodos);

  const listEntries: HomeListEntry[] = useMemo(() => {
    if (viewingProjectTodos) {
      const orgName = organizations.find((o) => o.id === filterOrg)?.name ?? null;
      const projectName =
        orgProjects.find((p) => p.id === filterProject)?.name ?? filterProject;
      return projectTodos
        .filter((row) =>
          matchesAssigneeProjectTodo(row, filterAssignee, currentUserId)
        )
        .map((todo) => ({
          kind: 'project' as const,
          todo,
          projectId: filterProject,
          organizationId: filterOrg,
          projectName,
          orgName,
        }));
    }

    let rows = todos;
    if (filterOrg === 'personal') {
      rows = rows.filter((x) => !x.organizationID);
    } else if (filterOrg !== 'all') {
      rows = rows.filter((x) => x.organizationID === filterOrg);
    }
    return rows
      .filter((row) => matchesAssigneeUserTodo(row, filterAssignee, currentUserId))
      .map((todo) => ({ kind: 'user' as const, todo }));
  }, [
    viewingProjectTodos,
    todos,
    filterOrg,
    filterProject,
    filterAssignee,
    currentUserId,
    projectTodos,
    organizations,
    orgProjects,
  ]);

  const completedCount = useMemo(
    () =>
      listEntries.filter((e) =>
        e.kind === 'user' ? e.todo.completed : e.todo.status === 'DONE'
      ).length,
    [listEntries]
  );
  const totalCount = listEntries.length;
  const hasMore = totalCount > MAX_VISIBLE;
  const visibleEntries = useMemo(
    () => (hasMore && !isExpanded ? listEntries.slice(0, MAX_VISIBLE) : listEntries),
    [hasMore, isExpanded, listEntries]
  );

  const visibleTodos = useMemo(
    () => visibleEntries.filter((e): e is Extract<HomeListEntry, { kind: 'user' }> => e.kind === 'user').map((e) => e.todo),
    [visibleEntries]
  );

  const getOrgName = useCallback(
    (orgId: string) => organizations.find((o) => o.id === orgId)?.name ?? null,
    [organizations]
  );

  const getAssignedDisplay = useCallback(
    (userId: string) => assignedUserNames[userId] ?? `@${userId.slice(0, 8)}…`,
    [assignedUserNames]
  );

  const handleDragEnd = useCallback(
    ({ data: reorderedSlice }: DragEndParams<TodoItemType>) => {
      onReorderDragActiveChange?.(false);
      if (hasMore && !isExpanded) {
        onReorderTodos([...reorderedSlice, ...todos.slice(MAX_VISIBLE)]);
      } else {
        onReorderTodos(reorderedSlice);
      }
    },
    [hasMore, isExpanded, todos, onReorderTodos, onReorderDragActiveChange]
  );

  const handleToggleProjectTodo = useCallback(async (todo: OrganizationProjectTodoPayload) => {
    const next = todo.status === 'DONE' ? 'OPEN' : 'DONE';
    try {
      await mfGoOrganizations.updateOrganizationProjectTodo({ todoId: todo.id, status: next });
      setProjectTodos((prev) => prev.map((x) => (x.id === todo.id ? { ...x, status: next } : x)));
    } catch {
      snackbarService.error(t('profile.organizations.projects.todoUpdateFailed'));
    }
  }, []);

  const renderTodoItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<TodoItemType>) => (
      <ShadowDecorator
        elevation={Platform.OS === 'android' ? 10 : 0}
        radius={12}
        opacity={isDark ? 0.35 : 0.14}
        color="#000"
      >
        {/* Subtle scale avoids 1.1 “halo” / fractional-pixel fringe at row edges */}
        <ScaleDecorator activeScale={1.02}>
          <TodoRow
            todo={item}
            orgName={item.organizationID ? getOrgName(item.organizationID) : null}
            assignedDisplay={item.assignedToUserID ? getAssignedDisplay(item.assignedToUserID) : ''}
            isDark={isDark}
            colors={colors}
            onEdit={onEditTodo}
            onToggle={onToggleComplete}
            onDragHandleLongPress={drag}
            isDragging={isActive}
            dragDisabled={false}
          />
        </ScaleDecorator>
      </ShadowDecorator>
    ),
    [getOrgName, getAssignedDisplay, isDark, colors, onEditTodo, onToggleComplete]
  );

  const orgSelected = filterOrg !== 'all' && filterOrg !== 'personal';

  const renderStaticEntry = useCallback(
    (entry: HomeListEntry, index: number) => {
      const wrap = (node: React.ReactNode) => (
        <View key={`${entry.kind}-${entry.todo.id}`}>
          {index > 0 ? <View style={{ height: Sizing.gap.s }} /> : null}
          {node}
        </View>
      );
      if (entry.kind === 'user') {
        return wrap(
          <TodoRow
            todo={entry.todo}
            orgName={entry.todo.organizationID ? getOrgName(entry.todo.organizationID) : null}
            assignedDisplay={
              entry.todo.assignedToUserID ? getAssignedDisplay(entry.todo.assignedToUserID) : ''
            }
            isDark={isDark}
            colors={colors}
            onEdit={onEditTodo}
            onToggle={onToggleComplete}
            onDragHandleLongPress={() => {}}
            isDragging={false}
            dragDisabled
          />
        );
      }
      const aid = entry.todo.assignedToUserId ?? '';
      return wrap(
        <ProjectTodoRow
          entry={entry}
          isDark={isDark}
          colors={colors}
          assignedDisplay={aid ? getAssignedDisplay(aid) : ''}
          onToggle={handleToggleProjectTodo}
          onLongPressEdit={() =>
            onEditProjectTodo?.({
              todo: entry.todo,
              organizationId: entry.organizationId,
              projectId: entry.projectId,
              organizationName: organizationDisplayName(entry.orgName, entry.organizationId),
              projectName: entry.projectName,
            })
          }
        />
      );
    },
    [
      getOrgName,
      getAssignedDisplay,
      isDark,
      colors,
      onEditTodo,
      onToggleComplete,
      handleToggleProjectTodo,
      onEditProjectTodo,
    ]
  );

  const keyExtractor = useCallback((item: TodoItemType) => item.id, []);

  const listSeparator = useCallback(() => <View style={{ height: Sizing.gap.s }} />, []);

  const sectionContainerStyle = useMemo(
    () => [
      todosSectionStyles.section,
      { borderRadius: SOFT_CARD_RADIUS, overflow: 'visible' as const },
      softSurfaceShadow(isDark),
    ],
    [isDark]
  );

  const cardInnerStyle = useMemo(
    () => ({
      borderRadius: SOFT_CARD_RADIUS,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surfaceBackground,
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 14,
      /* visible so dragged row + shadow are not clipped (was causing edge pixel glitches) */
      overflow: 'visible' as const,
    }),
    [colors.surfaceBorder, colors.surfaceBackground]
  );

  const emptyStateStyle = useMemo(
    () => [
      todosSectionStyles.emptyState,
      {
        backgroundColor: isDark ? colors.inputBackground : colors.tint + '06',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDark ? colors.surfaceBorder : colors.surfaceBorder + '80',
      },
    ],
    [isDark, colors.inputBackground, colors.tint, colors.surfaceBorder]
  );

  const handleExpandToggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((prev) => !prev);
  }, []);

  const filtersAreDefault =
    filterOrg === 'all' && filterAssignee === 'all' && filterProject === 'general';
  const emptyListMessage =
    todos.length === 0 && filtersAreDefault && !viewingProjectTodos
      ? t('home.todos.empty')
      : t('home.todos.listFilterEmpty');

  return (
    <View style={sectionContainerStyle}>
      <View style={cardInnerStyle}>
        <View style={todosSectionStyles.sectionHeader}>
          <View style={todosSectionStyles.titleRow}>
            <ThemedText
              type="subtitle"
              style={[todosSectionStyles.sectionTitle, { color: colors.bodyText }]}
            >
              {t('home.todos.title')}
            </ThemedText>
            {totalCount > 0 && (
              <View style={todosSectionStyles.countBadge}>
                <ThemedText
                  type="default"
                  style={[todosSectionStyles.countCompleted, { color: colors.tint }]}
                >
                  {completedCount}
                </ThemedText>
                <ThemedText
                  type="default"
                  style={[todosSectionStyles.countSeparator, { color: colors.labelText }]}
                >
                  /
                </ThemedText>
                <ThemedText
                  type="default"
                  style={[todosSectionStyles.countTotal, { color: colors.labelText }]}
                >
                  {totalCount}
                </ThemedText>
              </View>
            )}
          </View>
          <View style={todosSectionStyles.actionsRow}>
            <Pressable
              onPress={() => onRefresh(true)}
              disabled={isLoading}
              style={({ pressed }) => [
                todosSectionStyles.iconButton,
                { opacity: pressed ? 0.7 : isLoading ? 0.45 : 1 },
              ]}
              accessibilityLabel={t('home.todos.refresh')}
              accessibilityRole="button"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.tint} />
              ) : (
                <Ionicons name="refresh-outline" size={24} color={colors.tint} />
              )}
            </Pressable>
            <Pressable
              onPress={onAddTodo}
              disabled={isLoading}
              style={({ pressed }) => [
                todosSectionStyles.iconButton,
                { opacity: pressed ? 0.7 : isLoading ? 0.45 : 1 },
              ]}
              accessibilityLabel={t('home.todos.add')}
              accessibilityRole="button"
            >
              <Ionicons name="add-outline" size={24} color={colors.tint} />
            </Pressable>
          </View>
        </View>

        <ThemedText
          type="default"
          style={[
            todosSectionStyles.description,
            {
              color: isDark ? colors.bodyText : colors.labelText,
              opacity: isDark ? 0.92 : 1,
              paddingHorizontal: 0,
            },
          ]}
        >
          {t('home.todos.description')}
        </ThemedText>

        {projectFiltersEnabled && !isLoading ? (
          <>
            <ThemedText
              type="default"
              style={[
                todosSectionStyles.filterHint,
                { color: colors.labelText, opacity: isDark ? 0.88 : 1 },
              ]}
            >
              {t('home.todos.listFilterHint')}
            </ThemedText>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={todosSectionStyles.filterRow}
              keyboardShouldPersistTaps="handled"
            >
              <TouchableOpacity
                onPress={() => selectOrg('all')}
                activeOpacity={0.7}
                style={[
                  todosSectionStyles.filterChip,
                  {
                    backgroundColor: filterOrg === 'all' ? colors.tint : colors.surfaceBackground,
                    borderColor: colors.surfaceBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    todosSectionStyles.filterChipText,
                    { color: filterOrg === 'all' ? onTint : colors.bodyText },
                  ]}
                >
                  {t('home.todos.listFilterAll')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => selectOrg('personal')}
                activeOpacity={0.7}
                style={[
                  todosSectionStyles.filterChip,
                  {
                    backgroundColor:
                      filterOrg === 'personal' ? colors.tint : colors.surfaceBackground,
                    borderColor: colors.surfaceBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    todosSectionStyles.filterChipText,
                    {
                      color: filterOrg === 'personal' ? onTint : colors.bodyText,
                    },
                  ]}
                >
                  {t('home.todos.listFilterPersonal')}
                </Text>
              </TouchableOpacity>
              {organizations.map((o) => {
                const orgLabel = o.name?.trim() || o.id.slice(0, 8) + '…';
                const orgA11yLabel = o.name?.trim() || o.id;
                return (
                  <TouchableOpacity
                    key={o.id}
                    accessibilityLabel={orgA11yLabel}
                    onPress={() => selectOrg(o.id)}
                    activeOpacity={0.7}
                    style={[
                      todosSectionStyles.filterChip,
                      todosSectionStyles.filterOrgChip,
                      {
                        maxWidth: orgFilterChipMaxWidth,
                        backgroundColor: filterOrg === o.id ? colors.tint : colors.surfaceBackground,
                        borderColor: colors.surfaceBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        todosSectionStyles.filterChipText,
                        { color: filterOrg === o.id ? onTint : colors.bodyText },
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {orgLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {orgSelected ? (
              <>
                {orgProjectsLoading ? (
                  <ThemedText
                    type="default"
                    style={[
                      todosSectionStyles.filterHint,
                      { color: colors.labelText, marginBottom: 6 },
                    ]}
                  >
                    {t('home.todos.listFilterProjectsLoading')}
                  </ThemedText>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={todosSectionStyles.filterRow}
                    keyboardShouldPersistTaps="handled"
                  >
                    <TouchableOpacity
                      onPress={() => selectProject('general')}
                      activeOpacity={0.7}
                      style={[
                        todosSectionStyles.filterChip,
                        {
                          backgroundColor:
                            filterProject === 'general' ? colors.tint : colors.surfaceBackground,
                          borderColor: colors.surfaceBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          todosSectionStyles.filterChipText,
                          {
                            color: filterProject === 'general' ? onTint : colors.bodyText,
                          },
                        ]}
                      >
                        {t('home.todos.listFilterGeneral')}
                      </Text>
                    </TouchableOpacity>
                    {orgProjects.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => selectProject(p.id)}
                        activeOpacity={0.7}
                        style={[
                          todosSectionStyles.filterChip,
                          {
                            backgroundColor:
                              filterProject === p.id ? colors.tint : colors.surfaceBackground,
                            borderColor: colors.surfaceBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            todosSectionStyles.filterChipText,
                            { color: filterProject === p.id ? onTint : colors.bodyText },
                          ]}
                          numberOfLines={1}
                        >
                          {p.name?.trim() || p.id.slice(0, 8) + '…'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            ) : null}

            <ThemedText
              type="default"
              style={[
                todosSectionStyles.filterHint,
                { color: colors.labelText, marginTop: 2 },
              ]}
            >
              {t('home.todos.listFilterAssigneeHint')}
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={todosSectionStyles.filterRow}
              keyboardShouldPersistTaps="handled"
            >
              {(
                [
                  { id: 'all' as const, label: t('profile.organizations.projects.todosFilterAll') },
                  ...(filterOrg === 'personal'
                    ? []
                    : ([
                        {
                          id: 'unassigned' as const,
                          label: t('profile.organizations.projects.todosFilterUnassigned'),
                        },
                      ] as const)),
                  { id: 'me' as const, label: t('profile.organizations.projects.todosFilterMine') },
                ] as const
              ).map((chip) => (
                <TouchableOpacity
                  key={chip.id}
                  onPress={() => selectAssignee(chip.id)}
                  onLongPress={
                    viewingProjectTodos
                      ? () => openProjectScreenWithAssigneeFilter(chip.id)
                      : undefined
                  }
                  delayLongPress={420}
                  activeOpacity={0.7}
                  style={[
                    todosSectionStyles.filterChip,
                    {
                      backgroundColor:
                        filterAssignee === chip.id ? colors.tint : colors.surfaceBackground,
                      borderColor: colors.surfaceBorder,
                    },
                  ]}
                  accessibilityHint={
                    viewingProjectTodos ? t('home.todos.assigneeFilterLongPressHint') : undefined
                  }
                >
                  <Text
                    style={[
                      todosSectionStyles.filterChipText,
                      { color: filterAssignee === chip.id ? onTint : colors.bodyText },
                    ]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}
              {orgSelected
                ? orgMembersForAssigneeChips.map((m) => (
                    <TouchableOpacity
                      key={m.userID}
                      onPress={() => selectAssignee(m.userID)}
                      onLongPress={
                        viewingProjectTodos
                          ? () => openProjectScreenWithAssigneeFilter(m.userID)
                          : undefined
                      }
                      delayLongPress={420}
                      activeOpacity={0.7}
                      style={[
                        todosSectionStyles.filterChip,
                        {
                          backgroundColor:
                            filterAssignee === m.userID ? colors.tint : colors.surfaceBackground,
                          borderColor: colors.surfaceBorder,
                        },
                      ]}
                      accessibilityHint={
                        viewingProjectTodos ? t('home.todos.assigneeFilterLongPressHint') : undefined
                      }
                    >
                      <Text
                        style={[
                          todosSectionStyles.filterChipText,
                          {
                            color: filterAssignee === m.userID ? onTint : colors.bodyText,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {m.userNickname?.trim() || `${m.userID.slice(0, 8)}…`}
                      </Text>
                    </TouchableOpacity>
                  ))
                : null}
            </ScrollView>

            {!reorderEnabled ? (
              <ThemedText
                type="default"
                style={[
                  todosSectionStyles.filterHint,
                  { color: colors.labelText, marginBottom: 4 },
                ]}
              >
                {t('home.todos.listReorderDisabledHint')}
              </ThemedText>
            ) : null}
          </>
        ) : null}

        {isLoading ? (
          <TodosListSkeleton />
        ) : viewingProjectTodos && projectTodosLoading ? (
          <View style={[todosSectionStyles.list, { paddingVertical: 20, alignItems: 'center' }]}>
            <ActivityIndicator color={colors.tint} />
            <ThemedText
              type="default"
              style={[{ color: colors.labelText, marginTop: 8, fontSize: 13 }]}
            >
              {t('home.todos.listFilterProjectTodosLoading')}
            </ThemedText>
          </View>
        ) : listEntries.length === 0 ? (
          <View style={todosSectionStyles.list}>
            <View style={emptyStateStyle}>
              <ThemedText
                type="default"
                style={[todosSectionStyles.emptyText, { color: colors.bodyText }]}
              >
                {emptyListMessage}
              </ThemedText>
            </View>
          </View>
        ) : reorderEnabled ? (
          <DraggableFlatList
            data={visibleTodos}
            keyExtractor={keyExtractor}
            renderItem={renderTodoItem}
            onDragBegin={() => onReorderDragActiveChange?.(true)}
            onDragEnd={handleDragEnd}
            ItemSeparatorComponent={listSeparator}
            containerStyle={todosSectionStyles.draggableList}
            scrollEnabled={false}
            dragItemOverflow
            activationDistance={12}
            extraData={`${isDark}-${isExpanded}`}
          />
        ) : (
          <View style={todosSectionStyles.list}>{visibleEntries.map(renderStaticEntry)}</View>
        )}

        {!isLoading && hasMore && (
          <Pressable
            onPress={handleExpandToggle}
            style={({ pressed }) => [
              todosSectionStyles.expandButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityLabel={isExpanded ? t('home.todos.collapse') : t('home.todos.expand')}
            accessibilityRole="button"
          >
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={colors.tint}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
});
