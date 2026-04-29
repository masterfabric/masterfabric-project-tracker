import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import {
  mfGoOrganizations,
  mfGoTodos,
  type OrganizationProjectPayload,
  type OrganizationProjectTodoPayload,
  type UserTodoPayload,
} from '@/src/shared/services/mf-go-api';
import { snackbarService } from '@/src/shared/services/snackbar-service';
import { useAppStore } from '@/src/shared/store';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

type ArchivedProjectRow = {
  project: OrganizationProjectPayload;
  contextOrganizationName: string;
  hostOrganizationName: string;
  sourceKey: 'org' | 'sharedProject';
};

type ArchivedProjectTodoRow = {
  todo: OrganizationProjectTodoPayload;
  projectId: string;
  projectName: string;
  contextOrganizationName: string;
  hostOrganizationName: string;
  sourceKey: 'orgProject' | 'sharedProject';
};

type ArchivedLoadResult = {
  archivedTodos: UserTodoPayload[];
  archivedProjects: ArchivedProjectRow[];
  archivedProjectTodos: ArchivedProjectTodoRow[];
  organizationNameById: Map<string, string>;
};

async function fetchArchivedData(): Promise<ArchivedLoadResult> {
  const [myArchivedTodos, organizations] = await Promise.all([
    mfGoTodos.myArchivedTodos(),
    mfGoOrganizations.myOrganizations(),
  ]);
  const organizationNameById = new Map(organizations.map((org) => [org.id, org.name] as const));
  const archivedProjectsById = new Map<string, ArchivedProjectRow>();
  const allProjectsById = new Map<string, ArchivedProjectRow>();

  await Promise.all(
    organizations.map(async (org) => {
      const [activeProjects, archivedOrgProjects] = await Promise.all([
        mfGoOrganizations.organizationProjects(org.id),
        mfGoOrganizations.archivedOrganizationProjects(org.id),
      ]);
      const toRow = (project: OrganizationProjectPayload): ArchivedProjectRow => ({
        project,
        contextOrganizationName: org.name,
        hostOrganizationName: organizationNameById.get(project.organizationId) ?? org.name,
        sourceKey: project.organizationId === org.id ? 'org' : 'sharedProject',
      });
      for (const project of activeProjects) {
        if (!allProjectsById.has(project.id)) allProjectsById.set(project.id, toRow(project));
      }
      for (const project of archivedOrgProjects) {
        const row = toRow(project);
        if (!allProjectsById.has(project.id)) allProjectsById.set(project.id, row);
        if (!archivedProjectsById.has(project.id)) archivedProjectsById.set(project.id, row);
      }
    })
  );

  const archivedProjectTodosById = new Map<string, ArchivedProjectTodoRow>();
  await Promise.all(
    Array.from(allProjectsById.values()).map(async (projectRow) => {
      const todos = await mfGoOrganizations.archivedOrganizationProjectTodos(projectRow.project.id);
      for (const todo of todos) {
        if (archivedProjectTodosById.has(todo.id)) continue;
        archivedProjectTodosById.set(todo.id, {
          todo,
          projectId: projectRow.project.id,
          projectName: projectRow.project.name,
          contextOrganizationName: projectRow.contextOrganizationName,
          hostOrganizationName: projectRow.hostOrganizationName,
          sourceKey: projectRow.sourceKey === 'sharedProject' ? 'sharedProject' : 'orgProject',
        });
      }
    })
  );

  return {
    archivedTodos: myArchivedTodos,
    archivedProjects: Array.from(archivedProjectsById.values()),
    archivedProjectTodos: Array.from(archivedProjectTodosById.values()),
    organizationNameById,
  };
}

export function ArchivedItemsScreen() {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archivedTodos, setArchivedTodos] = useState<UserTodoPayload[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<ArchivedProjectRow[]>([]);
  const [archivedProjectTodos, setArchivedProjectTodos] = useState<ArchivedProjectTodoRow[]>([]);
  const [organizationNameById, setOrganizationNameById] = useState<Map<string, string>>(new Map());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchArchivedData();
      setArchivedTodos(data.archivedTodos);
      setArchivedProjects(data.archivedProjects);
      setArchivedProjectTodos(data.archivedProjectTodos);
      setOrganizationNameById(data.organizationNameById);
    } catch (e) {
      setError(getGraphQLErrorMessage(e));
    } finally {
      if (refresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(tabs)');
      return;
    }
    void load(false);
  }, [isAuthenticated, load]);

  const hasAnyRows = useMemo(
    () =>
      archivedTodos.length > 0 || archivedProjects.length > 0 || archivedProjectTodos.length > 0,
    [archivedTodos.length, archivedProjects.length, archivedProjectTodos.length]
  );

  const withBusy = useCallback(async (id: string, fn: () => Promise<void>) => {
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await fn();
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  if (!isAuthenticated) return null;

  const removeArchivedTodo = (id: string) =>
    setArchivedTodos((prev) => prev.filter((row) => row.id !== id));
  const removeArchivedProjectTodo = (id: string) =>
    setArchivedProjectTodos((prev) => prev.filter((row) => row.todo.id !== id));
  const removeArchivedProject = (projectId: string) =>
    setArchivedProjects((prev) => prev.filter((row) => row.project.id !== projectId));

  const sourceLabelForTodo = (todo: UserTodoPayload): string => {
    if (!todo.organizationID) return t('profile.archivedItems.source.personal');
    const orgName = organizationNameById.get(todo.organizationID) ?? todo.organizationID;
    return t('profile.archivedItems.source.org', { org: orgName });
  };

  const sourceLabelForProject = (row: ArchivedProjectRow): string =>
    row.sourceKey === 'sharedProject'
      ? t('profile.archivedItems.source.sharedProject', {
          org: row.contextOrganizationName,
          host: row.hostOrganizationName,
        })
      : t('profile.archivedItems.source.orgProject', { org: row.contextOrganizationName });

  const sourceLabelForProjectTodo = (row: ArchivedProjectTodoRow): string =>
    row.sourceKey === 'sharedProject'
      ? t('profile.archivedItems.source.sharedProjectTodo', {
          project: row.projectName,
          org: row.contextOrganizationName,
        })
      : t('profile.archivedItems.source.orgProjectTodo', {
          project: row.projectName,
          org: row.contextOrganizationName,
        });

  const handleUnarchiveTodo = async (todo: UserTodoPayload) => {
    await withBusy(`todo:${todo.id}`, async () => {
      try {
        await mfGoTodos.unarchiveTodo(todo.id);
        removeArchivedTodo(todo.id);
        snackbarService.success(t('profile.archivedItems.unarchiveSuccess'));
      } catch (e) {
        snackbarService.error(getGraphQLErrorMessage(e));
      }
    });
  };

  const handleUnarchiveProjectTodo = async (row: ArchivedProjectTodoRow) => {
    await withBusy(`projectTodo:${row.todo.id}`, async () => {
      try {
        await mfGoOrganizations.unarchiveOrganizationProjectTodo(row.todo.id);
        removeArchivedProjectTodo(row.todo.id);
        snackbarService.success(t('profile.archivedItems.unarchiveSuccess'));
      } catch (e) {
        snackbarService.error(getGraphQLErrorMessage(e));
      }
    });
  };

  const handleUnarchiveProject = async (row: ArchivedProjectRow) => {
    await withBusy(`project:${row.project.id}`, async () => {
      try {
        await mfGoOrganizations.unarchiveOrganizationProject(row.project.id);
        removeArchivedProject(row.project.id);
        snackbarService.success(t('profile.archivedItems.unarchiveSuccess'));
      } catch (e) {
        snackbarService.error(getGraphQLErrorMessage(e));
      }
    });
  };

  const rowStyle = {
    borderWidth: 1,
    borderColor: isDark ? '#38383A' : '#DCDCE0',
    borderRadius: 12,
    padding: Sizing.padding.m,
    marginBottom: 10,
    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
    gap: 8,
  } as const;

  return (
    <AppBarScaffold
      backgroundColor={colors.settingsBackground}
      appBar={
        <ScreenHeader
          title={t('profile.archivedItems.title')}
          subtitle={t('profile.archivedItems.subtitle')}
          onBackPress={() => router.back()}
          showBackButton={true}
          variant="minimal"
        />
      }
    >
      {loading ? (
        <View style={{ paddingTop: 40, alignItems: 'center', gap: 10 }}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={{ color: colors.labelText }}>{t('profile.archivedItems.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: Sizing.padding.m, paddingBottom: Sizing.padding.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
        >
          {error ? (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.errorColor ?? '#FF3B30' }}>{error}</Text>
            </View>
          ) : null}
          {!hasAnyRows ? (
            <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
              <Ionicons name="archive-outline" size={26} color={colors.labelText} />
              <Text style={{ color: colors.labelText, textAlign: 'center' }}>
                {t('profile.archivedItems.empty')}
              </Text>
            </View>
          ) : null}
          {archivedTodos.length > 0 ? (
            <View style={{ marginBottom: 10 }}>
              <Text style={{ color: colors.labelText, marginBottom: 8, fontWeight: '600' }}>
                {t('profile.archivedItems.sections.todos')}
              </Text>
              {archivedTodos.map((todo) => (
                <View key={todo.id} style={rowStyle}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{todo.title}</Text>
                  <Text style={{ color: colors.labelText, fontSize: 13 }}>{sourceLabelForTodo(todo)}</Text>
                  <Pressable
                    onPress={() => void handleUnarchiveTodo(todo)}
                    disabled={busyIds.has(`todo:${todo.id}`)}
                    style={({ pressed }) => ({
                      alignSelf: 'flex-start',
                      opacity: pressed || busyIds.has(`todo:${todo.id}`) ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ color: colors.tint, fontWeight: '600' }}>
                      {t('profile.archivedItems.actions.unarchive')}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          {archivedProjectTodos.length > 0 ? (
            <View style={{ marginBottom: 10 }}>
              <Text style={{ color: colors.labelText, marginBottom: 8, fontWeight: '600' }}>
                {t('profile.archivedItems.sections.projectTodos')}
              </Text>
              {archivedProjectTodos.map((row) => (
                <View key={row.todo.id} style={rowStyle}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{row.todo.title}</Text>
                  <Text style={{ color: colors.labelText, fontSize: 13 }}>{sourceLabelForProjectTodo(row)}</Text>
                  <Pressable
                    onPress={() => void handleUnarchiveProjectTodo(row)}
                    disabled={busyIds.has(`projectTodo:${row.todo.id}`)}
                    style={({ pressed }) => ({
                      alignSelf: 'flex-start',
                      opacity: pressed || busyIds.has(`projectTodo:${row.todo.id}`) ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ color: colors.tint, fontWeight: '600' }}>
                      {t('profile.archivedItems.actions.unarchive')}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          {archivedProjects.length > 0 ? (
            <View>
              <Text style={{ color: colors.labelText, marginBottom: 8, fontWeight: '600' }}>
                {t('profile.archivedItems.sections.projects')}
              </Text>
              {archivedProjects.map((row) => (
                <View key={row.project.id} style={rowStyle}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{row.project.name}</Text>
                  <Text style={{ color: colors.labelText, fontSize: 13 }}>{sourceLabelForProject(row)}</Text>
                  <Pressable
                    onPress={() => void handleUnarchiveProject(row)}
                    disabled={busyIds.has(`project:${row.project.id}`)}
                    style={({ pressed }) => ({
                      alignSelf: 'flex-start',
                      opacity: pressed || busyIds.has(`project:${row.project.id}`) ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ color: colors.tint, fontWeight: '600' }}>
                      {t('profile.archivedItems.actions.unarchive')}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </AppBarScaffold>
  );
}
