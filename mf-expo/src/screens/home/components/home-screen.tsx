import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { useThemeColors } from 'masterfabric-expo-core';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import { mfGoOrganizations, mfGoTodos } from '@/src/shared/services/mf-go-api';
import { snackbarService } from '@/src/shared/services/snackbar-service';
import type { OrganizationProjectTodoPayload, UserTodoPayload } from '@/src/shared/services/mf-go-api';

type EditingHomeProjectTodoState = {
  todo: OrganizationProjectTodoPayload;
  organizationId: string;
  projectId: string;
  organizationName: string;
  projectName: string;
};

function userTodoShapeFromHomeProjectTodo(
  ctx: EditingHomeProjectTodoState,
  userId: string
): UserTodoPayload {
  const row = ctx.todo;
  return {
    id: row.id,
    userID: userId,
    title: row.title,
    completed: row.status === 'DONE',
    organizationID: ctx.organizationId,
    assignedToUserID: row.assignedToUserId ?? null,
    dueAt: row.dueAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
import {
  createLocalTodo,
  updateLocalTodo,
  deleteLocalTodo,
  type LocalTodoPayload,
} from '@/src/shared/services/local-todos-service';
import {
  cancelTodoReminder,
  localTodoToReminderPayload,
  projectTodoToReminderPayload,
  syncTodoReminder,
  userTodoToReminderPayload,
} from '@/src/shared/services/todo-reminders-service';
import { InAppMessageProvider } from '@/src/screens/in-app-messaging/components/in-app-message-provider';
import { useLocale } from '@/src/shared/hooks/use-locale';
import { useUserMessages } from '@/src/shared/hooks/use-user-messages';
import { useHomeViewModel } from '../hooks/use-home-view-model';
import { homeScreenStyles } from '../styles/home-screen.styles';
import { AuthBanner } from './auth-banner';
import { EnvironmentSwitcherSheet } from './environment-switcher-sheet';
import { HomeHeader } from './home-header';
import { LocalTodosImportSheet } from './local-todos-import-sheet';
import { HomeScreenSkeleton } from './skeletons/home-screen-skeleton';
import { TodosSection } from './sections/todos-section';
import { TodoSheet } from './todo-sheet';
import { OrganizationNewsSection } from './sections/organization-news-section';
import { WelcomeSection } from './sections/welcome-section';
import { OwnerDashboardEntryCard } from '@/src/screens/organization';

function HomeScreenContent() {
  const colors = useThemeColors();

  // Subscribe to locale changes so home re-renders when language changes
  useLocale();

  // User messages subscription (snackbar on new message)
  useUserMessages();

  const {
    user,
    profile,
    todos,
    todosLoading,
    organizations,
    assignedUserNames,
    isInitialLoad,
    isMfGoAuthenticated,
    fetchTodos,
    fetchOrgMembers,
    handleToggleComplete,
    handleNotificationPress,
    localTodosForImport,
    handleImportLocalTodos,
    handleSkipImport,
    handleReorderTodos,
  } = useHomeViewModel();

  const [showTodoSheet, setShowTodoSheet] = useState(false);
  const [editingTodo, setEditingTodo] = useState<UserTodoPayload | LocalTodoPayload | null>(null);
  const [editingHomeProjectTodo, setEditingHomeProjectTodo] =
    useState<EditingHomeProjectTodoState | null>(null);
  const [showEnvSwitcher, setShowEnvSwitcher] = useState(false);
  /** While reordering todos, disable home scroll so pan gestures do not fight the parent ScrollView. */
  const [homeScrollEnabled, setHomeScrollEnabled] = useState(true);
  /** Bumps so TodosSection refetches `organizationProjectTodos` when home is focused or refreshed. */
  const [projectTodosSyncKey, setProjectTodosSyncKey] = useState(0);
  const [archivedTodoIds, setArchivedTodoIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      setProjectTodosSyncKey((k) => k + 1);
    }, [])
  );

  const handleHomeTodosRefresh = useCallback(() => {
    fetchTodos(true);
    setProjectTodosSyncKey((k) => k + 1);
  }, [fetchTodos]);

  const handleTodosReorderDragChange = useCallback((dragging: boolean) => {
    setHomeScrollEnabled(!dragging);
  }, []);

  useEffect(() => {
    return () => setHomeScrollEnabled(true);
  }, []);

  const handleEnvSwitcherClose = useCallback(() => setShowEnvSwitcher(false), []);
  const handleEnvSwitched = useCallback(() => fetchTodos(true), [fetchTodos]);

  const handleAddTodo = useCallback(() => {
    setEditingHomeProjectTodo(null);
    setEditingTodo(null);
    setShowTodoSheet(true);
  }, []);

  const handleEditTodo = useCallback((todo: UserTodoPayload | LocalTodoPayload) => {
    setEditingHomeProjectTodo(null);
    setEditingTodo(todo);
    setShowTodoSheet(true);
  }, []);

  const handleEditProjectTodoFromHomeFilter = useCallback(
    (payload: EditingHomeProjectTodoState) => {
      setEditingTodo(null);
      setEditingHomeProjectTodo(payload);
      setShowTodoSheet(true);
    },
    []
  );

  const handleCloseTodoSheet = useCallback(() => {
    setShowTodoSheet(false);
    setEditingTodo(null);
    setEditingHomeProjectTodo(null);
  }, []);

  const handleArchiveTodo = useCallback(
    async (todo: UserTodoPayload | LocalTodoPayload) => {
      if (!isMfGoAuthenticated || todo.id.startsWith('local-')) {
        snackbarService.info(t('home.todos.archiveRequiresAccount'));
        return;
      }
      const todoId = todo.id;
      setArchivedTodoIds((prev) => new Set(prev).add(todoId));
      try {
        await mfGoTodos.archiveTodo(todoId);
      } catch (err) {
        setArchivedTodoIds((prev) => {
          const next = new Set(prev);
          next.delete(todoId);
          return next;
        });
        snackbarService.error(getGraphQLErrorMessage(err));
        return;
      }
      snackbarService.show({
        message: t('home.todos.archivedUndoHint'),
        type: 'info',
        duration: 5000,
        action: {
          label: t('common.undo'),
          onPress: () => {
            void (async () => {
              try {
                await mfGoTodos.unarchiveTodo(todoId);
                setArchivedTodoIds((prev) => {
                  const next = new Set(prev);
                  next.delete(todoId);
                  return next;
                });
              } catch {
                snackbarService.error(t('home.todos.undoArchiveFailed'));
              }
            })();
          },
        },
      });
    },
    [isMfGoAuthenticated]
  );

  const visibleTodos = useMemo(
    () => todos.filter((row) => !archivedTodoIds.has(row.id)),
    [todos, archivedTodoIds]
  );

  const organizationProjectEditLock = useMemo(
    () =>
      editingHomeProjectTodo
        ? {
            organizationId: editingHomeProjectTodo.organizationId,
            projectId: editingHomeProjectTodo.projectId,
            organizationName: editingHomeProjectTodo.organizationName,
            projectName: editingHomeProjectTodo.projectName,
          }
        : null,
    [editingHomeProjectTodo]
  );

  const todoSheetPayload = useMemo(() => {
    if (editingHomeProjectTodo) {
      return userTodoShapeFromHomeProjectTodo(editingHomeProjectTodo, user?.id ?? '');
    }
    return editingTodo;
  }, [editingHomeProjectTodo, editingTodo, user?.id]);

  const handleSaveTodo = useCallback(
    async (input: {
      title: string;
      completed?: boolean;
      id?: string;
      organizationID?: string | null;
      assignedToUserID?: string | null;
      organizationProjectId?: string | null;
      dueAt?: string | null;
      clearDueAt?: boolean;
    }) => {
      try {
        let dueAtNotSaved = false;
        if (isMfGoAuthenticated) {
          if (
            editingHomeProjectTodo &&
            input.id === editingHomeProjectTodo.todo.id
          ) {
            const nextStatus = input.completed ? 'DONE' : 'OPEN';
            const updated = await mfGoOrganizations.updateOrganizationProjectTodo({
              todoId: editingHomeProjectTodo.todo.id,
              title: input.title,
              status: nextStatus,
              ...(input.clearDueAt ? { clearDueAt: true } : {}),
              ...(input.dueAt ? { dueAt: input.dueAt } : {}),
            });
            dueAtNotSaved = Boolean(updated._dueAtNotSaved);
            void syncTodoReminder(projectTodoToReminderPayload(updated));
            fetchTodos(true);
            setProjectTodosSyncKey((k) => k + 1);
            if (dueAtNotSaved) {
              snackbarService.info(t('home.todos.dueAtNotSavedOnServer'), 4200);
            }
            return null;
          }
          if (input.organizationProjectId && !input.id) {
            const created = await mfGoOrganizations.createOrganizationProjectTodo({
              projectId: input.organizationProjectId,
              title: input.title,
              assignedToUserId: input.assignedToUserID ?? undefined,
              dueAt: input.dueAt ?? undefined,
            });
            dueAtNotSaved = Boolean(created._dueAtNotSaved);
            fetchTodos(true);
            setProjectTodosSyncKey((k) => k + 1);
            snackbarService.success(t('home.todos.addedToProjectList'), 3200);
            if (dueAtNotSaved) {
              snackbarService.info(t('home.todos.dueAtNotSavedOnServer'), 4200);
            }
            void syncTodoReminder(projectTodoToReminderPayload(created));
            return null;
          }
          if (input.id && !input.id.startsWith('local-')) {
            const updated = await mfGoTodos.updateTodo({
              id: input.id,
              title: input.title,
              completed: input.completed,
              organizationID: input.organizationID ?? undefined,
              clearOrganization: !input.organizationID,
              assignedToUserID: input.assignedToUserID ?? undefined,
              ...(input.clearDueAt ? { clearDueAt: true } : {}),
              ...(input.dueAt ? { dueAt: input.dueAt } : {}),
            });
            dueAtNotSaved = Boolean(updated._dueAtNotSaved);
            void syncTodoReminder(userTodoToReminderPayload(updated));
          } else {
            const created = await mfGoTodos.createTodo({
              title: input.title,
              completed: input.completed ?? false,
              organizationID: input.organizationID ?? undefined,
              assignedToUserID: input.assignedToUserID ?? undefined,
              dueAt: input.dueAt ?? undefined,
            });
            dueAtNotSaved = Boolean(created._dueAtNotSaved);
            void syncTodoReminder(userTodoToReminderPayload(created));
          }
        } else {
          if (input.id && input.id.startsWith('local-')) {
            const loc = await updateLocalTodo({
              id: input.id,
              title: input.title,
              completed: input.completed,
              ...(input.clearDueAt ? { clearDueAt: true } : {}),
              ...(input.dueAt && !input.clearDueAt ? { dueAt: input.dueAt } : {}),
            });
            if (loc) {
              void syncTodoReminder(localTodoToReminderPayload(loc));
            }
          } else {
            const loc = await createLocalTodo({
              title: input.title,
              completed: input.completed ?? false,
              dueAt: input.dueAt ?? undefined,
            });
            void syncTodoReminder(localTodoToReminderPayload(loc));
          }
        }
        fetchTodos(true);
        if (dueAtNotSaved) {
          snackbarService.info(t('home.todos.dueAtNotSavedOnServer'), 4200);
        }
        return null;
      } catch (err) {
        return getGraphQLErrorMessage(err);
      }
    },
    [fetchTodos, isMfGoAuthenticated, t, editingHomeProjectTodo]
  );

  const handleDeleteTodo = useCallback(
    async (id: string) => {
      try {
        if (editingHomeProjectTodo && editingHomeProjectTodo.todo.id === id) {
          await mfGoOrganizations.deleteOrganizationProjectTodo(id);
          void cancelTodoReminder(id);
          fetchTodos(true);
          setProjectTodosSyncKey((k) => k + 1);
          return null;
        }
        if (isMfGoAuthenticated && !id.startsWith('local-')) {
          await mfGoTodos.deleteTodo(id);
        } else {
          await deleteLocalTodo(id);
        }
        void cancelTodoReminder(id);
        fetchTodos(true);
        return null;
      } catch (err) {
        return getGraphQLErrorMessage(err);
      }
    },
    [fetchTodos, isMfGoAuthenticated, editingHomeProjectTodo]
  );

  const containerStyle = useMemo(
    () => [homeScreenStyles.container, { backgroundColor: colors.background }],
    [colors.background]
  );

  const handleTitleTripleTap = useCallback(() => setShowEnvSwitcher(true), []);

  if (isInitialLoad) {
    return <HomeScreenSkeleton />;
  }

  return (
    <InAppMessageProvider>
      <SafeAreaView style={containerStyle} edges={['top', 'bottom']}>
        <View style={{ flex: 1 }}>
          <HomeHeader
            onNotificationPress={handleNotificationPress}
            onTitleTripleTap={handleTitleTripleTap}
          />
          <ScrollView
            style={homeScreenStyles.content}
            contentContainerStyle={[homeScreenStyles.scrollContent, { paddingTop: 12 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            scrollEnabled={homeScrollEnabled}
          >
            <WelcomeSection
              user={user}
              profile={profile}
              organizations={isMfGoAuthenticated ? organizations : []}
            />
            {isMfGoAuthenticated && organizations.length > 0 && (
              <OwnerDashboardEntryCard
                userId={user?.id}
                organizations={organizations}
              />
            )}
            {!isMfGoAuthenticated && <AuthBanner />}
            <TodosSection
              todos={visibleTodos}
              organizations={organizations}
              assignedUserNames={assignedUserNames}
              isLoading={todosLoading}
              onRefresh={handleHomeTodosRefresh}
              onAddTodo={handleAddTodo}
              onEditTodo={handleEditTodo}
              onEditProjectTodo={handleEditProjectTodoFromHomeFilter}
              onToggleComplete={handleToggleComplete}
              onReorderTodos={handleReorderTodos}
              onArchiveTodo={handleArchiveTodo}
              onReorderDragActiveChange={handleTodosReorderDragChange}
              currentUserId={user?.id ?? null}
              projectFiltersEnabled={isMfGoAuthenticated && organizations.length > 0}
              projectTodosSyncKey={projectTodosSyncKey}
            />
            <OrganizationNewsSection
              organizations={organizations}
              enabled={isMfGoAuthenticated && organizations.length > 0}
            />
          </ScrollView>
        </View>

        <TodoSheet
          visible={showTodoSheet}
          todo={todoSheetPayload}
          organizations={organizations}
          currentUserId={user?.id ?? null}
          organizationProjectEditLock={organizationProjectEditLock}
          fetchOrgMembers={fetchOrgMembers}
          onClose={handleCloseTodoSheet}
          onSave={handleSaveTodo}
          onDelete={todoSheetPayload ? handleDeleteTodo : undefined}
          onSubtasksChanged={() => fetchTodos(false)}
        />

        <LocalTodosImportSheet
          visible={!!localTodosForImport?.length}
          localTodos={localTodosForImport ?? []}
          onImport={handleImportLocalTodos}
          onSkip={handleSkipImport}
        />

        <EnvironmentSwitcherSheet
          visible={showEnvSwitcher}
          onClose={handleEnvSwitcherClose}
          onSwitched={handleEnvSwitched}
        />
      </SafeAreaView>
    </InAppMessageProvider>
  );
}

export function HomeScreen() {
  return <HomeScreenContent />;
}