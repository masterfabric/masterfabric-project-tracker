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

type ArchivedFolderProjectBucket = {
  key: string;
  label: string;
  todos: ArchivedProjectTodoRow[];
  projects: ArchivedProjectRow[];
};

type ArchivedFolder = {
  key: string;
  label: string;
  generalTodos: UserTodoPayload[];
  projectBuckets: ArchivedFolderProjectBucket[];
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
      let activeProjects: OrganizationProjectPayload[] = [];
      let archivedOrgProjects: OrganizationProjectPayload[] = [];
      try {
        [activeProjects, archivedOrgProjects] = await Promise.all([
          mfGoOrganizations.organizationProjects(org.id),
          mfGoOrganizations.archivedOrganizationProjects(org.id),
        ]);
      } catch {
        // Partial access is expected in mixed org/project permission scenarios.
        return;
      }
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
      let todos: OrganizationProjectTodoPayload[] = [];
      try {
        todos = await mfGoOrganizations.archivedOrganizationProjectTodos(projectRow.project.id);
      } catch {
        // Project may be visible but archived todo list can still be forbidden for this user.
        return;
      }
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
  const [selectedFolderKey, setSelectedFolderKey] = useState<string | null>(null);
  const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(null);

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
      setSelectedFolderKey(null);
      setSelectedProjectKey(null);
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

  const personalTodos = useMemo(
    () => archivedTodos.filter((row) => !row.organizationID),
    [archivedTodos]
  );
  const orgScopedTodos = useMemo(
    () => archivedTodos.filter((row) => Boolean(row.organizationID)),
    [archivedTodos]
  );
  const hasAnyRows = useMemo(
    () => archivedTodos.length > 0 || archivedProjects.length > 0 || archivedProjectTodos.length > 0,
    [archivedTodos, archivedProjects, archivedProjectTodos]
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

  const orgFolders = useMemo<ArchivedFolder[]>(() => {
    const folders = new Map<
      string,
      {
        key: string;
        label: string;
        generalTodos: UserTodoPayload[];
        bucketsByKey: Map<string, ArchivedFolderProjectBucket>;
      }
    >();
    const folderKeyByLabel = new Map<string, string>();
    const ensureFolder = (folderLabel: string, preferredKey?: string) => {
      const normalizedLabel = folderLabel.trim().toLocaleLowerCase();
      const existingKey = folderKeyByLabel.get(normalizedLabel);
      const folderKey = existingKey ?? preferredKey ?? `org-label:${normalizedLabel}`;
      if (!folders.has(folderKey)) {
        folders.set(folderKey, {
          key: folderKey,
          label: folderLabel,
          generalTodos: [],
          bucketsByKey: new Map(),
        });
      }
      folderKeyByLabel.set(normalizedLabel, folderKey);
      return folders.get(folderKey)!;
    };

    for (const todo of orgScopedTodos) {
      const orgId = todo.organizationID ?? '';
      const orgName = organizationNameById.get(orgId) ?? orgId;
      ensureFolder(orgName, `org-id:${orgId}`).generalTodos.push(todo);
    }

    for (const row of archivedProjectTodos) {
      const folder = ensureFolder(row.contextOrganizationName);
      const projectKey = `project:${row.projectId}`;
      if (!folder.bucketsByKey.has(projectKey)) {
        folder.bucketsByKey.set(projectKey, {
          key: projectKey,
          label: row.projectName,
          todos: [],
          projects: [],
        });
      }
      folder.bucketsByKey.get(projectKey)!.todos.push(row);
    }

    for (const row of archivedProjects) {
      const folder = ensureFolder(row.contextOrganizationName);
      const projectKey = `project:${row.project.id}`;
      if (!folder.bucketsByKey.has(projectKey)) {
        folder.bucketsByKey.set(projectKey, {
          key: projectKey,
          label: row.project.name,
          todos: [],
          projects: [],
        });
      }
      folder.bucketsByKey.get(projectKey)!.projects.push(row);
    }

    return Array.from(folders.values())
      .map((folder) => ({
        key: folder.key,
        label: folder.label,
        generalTodos: folder.generalTodos,
        projectBuckets: Array.from(folder.bucketsByKey.values()).sort((a, b) =>
          a.label.localeCompare(b.label)
        ),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [orgScopedTodos, archivedProjectTodos, archivedProjects, organizationNameById]);

  const selectedFolder = useMemo(
    () => orgFolders.find((folder) => folder.key === selectedFolderKey) ?? null,
    [orgFolders, selectedFolderKey]
  );
  const selectedProject = useMemo(() => {
    if (!selectedFolder || !selectedProjectKey) return null;
    if (selectedProjectKey === 'general') {
      return {
        key: 'general',
        label: t('profile.archivedItems.sections.general'),
        todos: [] as ArchivedProjectTodoRow[],
        projects: [] as ArchivedProjectRow[],
      };
    }
    return selectedFolder.projectBuckets.find((bucket) => bucket.key === selectedProjectKey) ?? null;
  }, [selectedFolder, selectedProjectKey]);

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
            <View style={{ alignItems: 'center', paddingBottom: 12, gap: 10 }}>
              <Ionicons name="archive-outline" size={26} color={colors.labelText} />
              <Text style={{ color: colors.labelText, textAlign: 'center' }}>{t('profile.archivedItems.empty')}</Text>
            </View>
          ) : null}
          <View style={{ marginBottom: 10 }}>
            <Text style={{ color: colors.labelText, marginBottom: 8, fontWeight: '600' }}>
              {t('profile.archivedItems.sections.personal')}
            </Text>
            {personalTodos.length === 0 ? (
              <Text style={{ color: colors.labelText, marginBottom: 10 }}>
                {t('profile.archivedItems.emptyPersonal')}
              </Text>
            ) : null}
            {personalTodos.map((todo) => (
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
          {orgFolders.length > 0 ? (
            <View style={{ marginBottom: 10 }}>
              <Text style={{ color: colors.labelText, marginBottom: 8, fontWeight: '600' }}>
                {t('profile.archivedItems.sections.organizations')}
              </Text>
              {!selectedFolder ? (
                <>
                  <Text style={{ color: colors.labelText, marginBottom: 10 }}>
                    {t('profile.archivedItems.folder.selectOrganization')}
                  </Text>
                  {orgFolders.map((folder) => {
                    const count =
                      folder.generalTodos.length +
                      folder.projectBuckets.reduce(
                        (sum, bucket) => sum + bucket.todos.length + bucket.projects.length,
                        0
                      );
                    return (
                      <Pressable
                        key={folder.key}
                        onPress={() => {
                          setSelectedFolderKey(folder.key);
                          setSelectedProjectKey(null);
                        }}
                        style={({ pressed }) => [
                          rowStyle,
                          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
                          pressed ? { opacity: 0.85 } : null,
                        ]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                          <Ionicons name="folder-outline" size={18} color={colors.tint} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                              {folder.label}
                            </Text>
                            <Text style={{ color: colors.labelText, fontSize: 13 }}>
                              {t('profile.archivedItems.folder.itemsCount', { count })}
                            </Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.labelText} />
                      </Pressable>
                    );
                  })}
                </>
              ) : !selectedProject ? (
                <>
                  <Pressable
                    onPress={() => {
                      setSelectedFolderKey(null);
                      setSelectedProjectKey(null);
                    }}
                    style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Ionicons name="chevron-back" size={16} color={colors.tint} />
                    <Text style={{ color: colors.tint, fontWeight: '600' }}>
                      {t('profile.archivedItems.folder.backToFolders')}
                    </Text>
                  </Pressable>
                  <Text style={{ color: colors.text, marginBottom: 8, fontWeight: '600' }}>
                    {selectedFolder.label}
                  </Text>
                  <Text style={{ color: colors.labelText, marginBottom: 10 }}>
                    {t('profile.archivedItems.folder.selectProject')}
                  </Text>
                  {selectedFolder.generalTodos.length > 0 ? (
                    <Pressable
                      onPress={() => setSelectedProjectKey('general')}
                      style={({ pressed }) => [rowStyle, pressed ? { opacity: 0.85 } : null]}
                    >
                      <Text style={{ color: colors.text, fontWeight: '600' }}>
                        {t('profile.archivedItems.sections.general')}
                      </Text>
                      <Text style={{ color: colors.labelText }}>
                        {t('profile.archivedItems.folder.itemsCount', {
                          count: selectedFolder.generalTodos.length,
                        })}
                      </Text>
                    </Pressable>
                  ) : null}
                  {selectedFolder.projectBuckets.map((bucket) => {
                    const count = bucket.todos.length + bucket.projects.length;
                    return (
                      <Pressable
                        key={bucket.key}
                        onPress={() => setSelectedProjectKey(bucket.key)}
                        style={({ pressed }) => [rowStyle, pressed ? { opacity: 0.85 } : null]}
                      >
                        <Text style={{ color: colors.text, fontWeight: '600' }}>{bucket.label}</Text>
                        <Text style={{ color: colors.labelText }}>
                          {t('profile.archivedItems.folder.itemsCount', { count })}
                        </Text>
                      </Pressable>
                    );
                  })}
                </>
              ) : (
                <>
                  <Pressable
                    onPress={() => setSelectedProjectKey(null)}
                    style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Ionicons name="chevron-back" size={16} color={colors.tint} />
                    <Text style={{ color: colors.tint, fontWeight: '600' }}>
                      {t('profile.archivedItems.folder.backToProjects')}
                    </Text>
                  </Pressable>
                  <Text style={{ color: colors.text, marginBottom: 8, fontWeight: '600' }}>
                    {selectedFolder.label} / {selectedProject.label}
                  </Text>
                  {selectedProject.key === 'general'
                    ? selectedFolder.generalTodos.map((todo) => (
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
                      ))
                    : null}
                  {selectedProject.todos.map((row) => (
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
                  {selectedProject.projects.map((row) => (
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
                </>
              )}
            </View>
          ) : null}
        </ScrollView>
      )}
    </AppBarScaffold>
  );
}
