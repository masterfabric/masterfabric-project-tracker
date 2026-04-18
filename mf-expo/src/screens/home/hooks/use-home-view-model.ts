import {
  mfGoUser,
  mfGoTodos,
  mfGoOrganizations,
  type UserProfile,
  type UserTodoPayload,
  type OrganizationPayload,
  type OrganizationMemberPayload,
} from '@/src/shared/services/mf-go-api';
import {
  getLocalTodos,
  saveLocalTodos,
  createLocalTodo,
  updateLocalTodo,
  deleteLocalTodo,
  clearLocalTodos,
  type LocalTodoPayload,
} from '@/src/shared/services/local-todos-service';
import {
  applyTodoDisplayOrder,
  getTodoDisplayOrder,
  saveTodoDisplayOrder,
} from '@/src/shared/services/todo-display-order';
import {
  localTodoToReminderPayload,
  syncTodoReminder,
  syncTodoRemindersFromList,
  userTodoToReminderPayload,
} from '@/src/shared/services/todo-reminders-service';
import { useAppStore } from '@/src/shared/store';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function useHomeViewModel() {
  const authToken = useAppStore((s) => s.authToken);
  const mfGoSession = useAppStore((s) => s.mfGoSession);
  const user = useAppStore((s) => s.user);
  const isMfGoAuthenticated = !!(authToken && mfGoSession);

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [todos, setTodos] = useState<(UserTodoPayload | LocalTodoPayload)[]>([]);
  const [todosLoading, setTodosLoading] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationPayload[]>([]);
  const [assignedUserNames, setAssignedUserNames] = useState<Record<string, string>>({});
  const [localTodosForImport, setLocalTodosForImport] = useState<LocalTodoPayload[] | null>(null);

  useEffect(() => {
    // Short delay for skeleton display
    const t = setTimeout(() => setIsInitialLoad(false), 500);
    return () => clearTimeout(t);
  }, []);

  const fetchProfile = useCallback(() => {
    if (!isMfGoAuthenticated) {
      setProfile(null);
      return;
    }
    mfGoUser.me().then(setProfile).catch(() => setProfile(null));
  }, [isMfGoAuthenticated]);

  const syncOrgTab = useCallback((orgs: OrganizationPayload[]) => {
    useAppStore.getState().setShowOrgMessagesTab(orgs.length > 0);
  }, []);

  useEffect(() => {
    if (!isMfGoAuthenticated) {
      setProfile(null);
      setOrganizations([]);
      useAppStore.getState().setShowOrgMessagesTab(false);
      return;
    }
    fetchProfile();
    mfGoOrganizations
      .myOrganizations()
      .then((orgs) => {
        setOrganizations(orgs);
        syncOrgTab(orgs);
      })
      .catch(() => {
        setOrganizations([]);
        syncOrgTab([]);
      });
  }, [isMfGoAuthenticated, fetchProfile, syncOrgTab]);

  useFocusEffect(
    useCallback(() => {
      if (isMfGoAuthenticated) {
        fetchProfile();
        mfGoOrganizations
          .myOrganizations()
          .then((orgs) => {
            setOrganizations(orgs);
            syncOrgTab(orgs);
          })
          .catch(() => {
            setOrganizations([]);
            syncOrgTab([]);
          });
      }
    }, [isMfGoAuthenticated, fetchProfile, syncOrgTab])
  );

  /** Minimum time todos stay on skeleton so fast loads do not flash (ms). */
  const SKELETON_MIN_MS = 900;

  const fetchTodos = useCallback(
    async (showSkeleton = true) => {
      if (isMfGoAuthenticated) {
        if (showSkeleton) setTodosLoading(true);
        const start = Date.now();
        try {
          const data = await mfGoTodos.myTodos();
          const savedOrder = await getTodoDisplayOrder();
          const ordered = applyTodoDisplayOrder(data, savedOrder);
          if (showSkeleton) {
            const elapsed = Date.now() - start;
            const remaining = SKELETON_MIN_MS - elapsed;
            if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
          }
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setTodos(ordered);
          void syncTodoRemindersFromList(
            ordered.map((todo) =>
              todo.userID === 'local'
                ? localTodoToReminderPayload(todo as LocalTodoPayload)
                : userTodoToReminderPayload(todo as UserTodoPayload)
            )
          );
        } catch {
          if (showSkeleton) {
            const elapsed = Date.now() - start;
            const remaining = SKELETON_MIN_MS - elapsed;
            if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
          }
          setTodos([]);
        } finally {
          setTodosLoading(false);
        }
      } else {
        if (showSkeleton) setTodosLoading(true);
        const start = Date.now();
        try {
          const data = await getLocalTodos();
          const savedOrder = await getTodoDisplayOrder();
          const ordered = applyTodoDisplayOrder(data, savedOrder);
          if (showSkeleton) {
            const elapsed = Date.now() - start;
            const remaining = SKELETON_MIN_MS - elapsed;
            if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
          }
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setTodos(ordered);
          void syncTodoRemindersFromList(ordered.map((todo) => localTodoToReminderPayload(todo)));
        } finally {
          setTodosLoading(false);
        }
      }
    },
    [isMfGoAuthenticated]
  );

  const handleToggleComplete = useCallback(
    async (todo: UserTodoPayload | LocalTodoPayload) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setTodos((prev) =>
        prev.map((t) =>
          t.id === todo.id ? { ...t, completed: !t.completed } : t
        )
      );
      if (isMfGoAuthenticated && !todo.id.startsWith('local-')) {
        try {
          await mfGoTodos.updateTodo({
            id: todo.id,
            title: todo.title,
            completed: !todo.completed,
            organizationID: todo.organizationID ?? undefined,
            assignedToUserID: todo.assignedToUserID ?? undefined,
          });
          void syncTodoReminder(
            userTodoToReminderPayload({
              ...todo,
              completed: !todo.completed,
            } as UserTodoPayload)
          );
        } catch {
          setTodos((prev) =>
            prev.map((t) =>
              t.id === todo.id ? { ...t, completed: todo.completed } : t
            )
          );
        }
      } else {
        const updated = await updateLocalTodo({
          id: todo.id,
          completed: !todo.completed,
        });
        if (!updated) {
          setTodos((prev) =>
            prev.map((t) =>
              t.id === todo.id ? { ...t, completed: todo.completed } : t
            )
          );
        } else {
          void syncTodoReminder(localTodoToReminderPayload(updated));
        }
      }
    },
    [isMfGoAuthenticated]
  );

  const fetchOrgMembers = useCallback(
    async (orgId: string): Promise<OrganizationMemberPayload[]> => {
      if (!isMfGoAuthenticated) return [];
      try {
        return await mfGoOrganizations.organizationMembers(orgId);
      } catch {
        return [];
      }
    },
    [isMfGoAuthenticated]
  );

  useEffect(() => {
    fetchTodos();
  }, [isMfGoAuthenticated, fetchTodos]);

  // When user logs in, check for local todos to import
  useEffect(() => {
    if (!isMfGoAuthenticated) {
      setLocalTodosForImport(null);
      return;
    }
    let cancelled = false;
    getLocalTodos()
      .then((local) => {
        if (!cancelled && local.length > 0) {
          setLocalTodosForImport(local);
        }
      })
      .catch(() => {
        if (!cancelled) setLocalTodosForImport(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isMfGoAuthenticated]);

  const handleImportLocalTodos = useCallback(
    async (selectedIds: string[]) => {
      if (selectedIds.length === 0) {
        await clearLocalTodos();
        setLocalTodosForImport(null);
        fetchTodos(true);
        return;
      }
      const toImport = (localTodosForImport ?? []).filter((t) => selectedIds.includes(t.id));
      for (const todo of toImport) {
        await mfGoTodos.createTodo({
          title: todo.title,
          completed: todo.completed ?? false,
          dueAt: todo.dueAt ?? undefined,
        });
      }
      await clearLocalTodos();
      setLocalTodosForImport(null);
      fetchTodos(true);
    },
    [localTodosForImport, fetchTodos]
  );

  const handleSkipImport = useCallback(async () => {
    await clearLocalTodos();
    setLocalTodosForImport(null);
    fetchTodos(true);
  }, [fetchTodos]);

  const handleReorderTodos = useCallback(
    async (ordered: (UserTodoPayload | LocalTodoPayload)[]) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setTodos(ordered);
      await saveTodoDisplayOrder(ordered.map((t) => t.id));
      if (!isMfGoAuthenticated) {
        await saveLocalTodos(ordered as LocalTodoPayload[]);
      }
    },
    [isMfGoAuthenticated]
  );

  useEffect(() => {
    if (!isMfGoAuthenticated) {
      setAssignedUserNames({});
      return;
    }
    /** Resolve assignee display names from org membership for any org that has todos (not only rows with both fields). */
    const orgIds = [...new Set(todos.map((t) => t.organizationID).filter(Boolean))] as string[];
    if (orgIds.length === 0) {
      setAssignedUserNames({});
      return;
    }
    let cancelled = false;
    Promise.all(
      orgIds.map((id) => mfGoOrganizations.organizationMembers(id).catch(() => [] as OrganizationMemberPayload[]))
    )
      .then((memberLists) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        memberLists.flat().forEach((m) => {
          if (!map[m.userID]) {
            map[m.userID] = m.userNickname?.trim() || `@${m.userID.slice(0, 8)}…`;
          }
        });
        setAssignedUserNames(map);
      })
      .catch(() => {
        if (!cancelled) setAssignedUserNames({});
      });
    return () => {
      cancelled = true;
    };
  }, [todos, isMfGoAuthenticated]);

  const handleNotificationPress = useCallback(() => {
    try {
      console.log('Opening notifications...');
    } catch (error) {
      console.error('Error handling notification press:', error);
    }
  }, []);

  const handleSettingsPress = useCallback(() => {
    try {
      console.log('🔧 Navigating to settings from header...');
      router.push('/settings');
    } catch (error) {
      console.error('Error handling settings press:', error);
    }
  }, []);

  return {
    // Data
    user: user || null,
    profile,
    todos,
    todosLoading,
    organizations,
    assignedUserNames,
    isInitialLoad,
    isMfGoAuthenticated,
    localTodosForImport,
    // Actions
    fetchTodos,
    fetchOrgMembers,
    handleToggleComplete,
    handleNotificationPress,
    handleSettingsPress,
    handleImportLocalTodos,
    handleSkipImport,
    handleReorderTodos,
  };
}
