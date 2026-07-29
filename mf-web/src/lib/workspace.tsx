"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import { storage } from "./storage";
import { useAuth } from "./auth";
import type {
  Organization,
  Project,
  ProjectMember,
  StatusFilter,
  Todo,
  TodoStatus,
  ViewMode,
} from "./types";

interface WorkspaceContextValue {
  orgs: Organization[];
  projects: Project[];
  members: ProjectMember[];
  todos: Todo[];
  orgId: string | null;
  projectId: string | null;
  org: Organization | null;
  project: Project | null;
  viewMode: ViewMode;
  statusFilter: StatusFilter;
  query: string;
  loading: boolean;
  error: string | null;
  selectedTodoId: string | null;
  selectedTodo: Todo | null;
  setOrgId: (id: string | null) => void;
  setProjectId: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setStatusFilter: (f: StatusFilter) => void;
  setQuery: (q: string) => void;
  setSelectedTodoId: (id: string | null) => void;
  refreshOrgs: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  refreshTodos: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project>;
  createTodo: (title: string) => Promise<Todo>;
  updateTodoStatus: (todoId: string, status: TodoStatus) => Promise<void>;
  updateTodoTitle: (todoId: string, title: string) => Promise<void>;
  deleteTodo: (todoId: string) => Promise<void>;
  addSubtask: (todoId: string, title: string) => Promise<void>;
  toggleSubtask: (todoId: string, subtaskId: string, completed: boolean) => Promise<void>;
  deleteSubtask: (todoId: string, subtaskId: string) => Promise<void>;
  filteredTodos: Todo[];
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [orgId, setOrgIdState] = useState<string | null>(null);
  const [projectId, setProjectIdState] = useState<string | null>(null);
  const [viewMode, setViewModeState] = useState<ViewMode>("list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setOrgs([]);
      setProjects([]);
      setTodos([]);
      setMembers([]);
      setOrgIdState(null);
      setProjectIdState(null);
      return;
    }
    const savedView = storage.getViewMode();
    if (savedView === "list" || savedView === "board") {
      setViewModeState(savedView);
    }
    const savedOrg = storage.getOrgId();
    const savedProject = storage.getProjectId();
    if (savedOrg) setOrgIdState(savedOrg);
    if (savedProject) setProjectIdState(savedProject);
  }, [user]);

  const setOrgId = useCallback((id: string | null) => {
    storage.setOrgId(id);
    setOrgIdState(id);
    setProjectIdState(null);
    storage.setProjectId(null);
    setSelectedTodoId(null);
  }, []);

  const setProjectId = useCallback((id: string | null) => {
    storage.setProjectId(id);
    setProjectIdState(id);
    setSelectedTodoId(null);
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    storage.setViewMode(mode);
    setViewModeState(mode);
  }, []);

  const refreshOrgs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const list = await api.myOrganizations();
      setOrgs(list);
      setOrgIdState((prev) => {
        if (prev && list.some((o) => o.id === prev)) return prev;
        const next = list[0]?.id ?? null;
        storage.setOrgId(next);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshProjects = useCallback(async () => {
    if (!orgId) {
      setProjects([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await api.organizationProjects(orgId);
      setProjects(list);
      setProjectIdState((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev;
        const next = list[0]?.id ?? null;
        storage.setProjectId(next);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const refreshTodos = useCallback(async () => {
    if (!projectId || !orgId) {
      setTodos([]);
      setMembers([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [todoList, memberList] = await Promise.all([
        api.organizationProjectTodos(orgId, projectId),
        api.organizationProjectMembers(orgId, projectId),
      ]);
      setTodos(todoList);
      setMembers(memberList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load issues");
    } finally {
      setLoading(false);
    }
  }, [orgId, projectId]);

  useEffect(() => {
    void refreshOrgs();
  }, [refreshOrgs]);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    void refreshTodos();
  }, [refreshTodos]);

  const createProject = useCallback(
    async (name: string, description?: string) => {
      if (!orgId) throw new Error("Select an organization first");
      const project = await api.createOrganizationProject({
        organizationId: orgId,
        name,
        description,
      });
      await refreshProjects();
      setProjectId(project.id);
      return project;
    },
    [orgId, refreshProjects, setProjectId],
  );

  const createTodo = useCallback(
    async (title: string) => {
      if (!projectId || !orgId) throw new Error("Select a project first");
      const todo = await api.createOrganizationProjectTodo({
        organizationId: orgId,
        projectId,
        title,
      });
      setTodos((prev) => [todo, ...prev]);
      setSelectedTodoId(todo.id);
      return todo;
    },
    [orgId, projectId],
  );

  const updateTodoStatus = useCallback(
    async (todoId: string, status: TodoStatus) => {
      if (!orgId) return;
      let snapshot: Todo | undefined;
      setTodos((prev) => {
        snapshot = prev.find((t) => t.id === todoId);
        return prev.map((t) => (t.id === todoId ? { ...t, status } : t));
      });
      try {
        const updated = await api.updateOrganizationProjectTodo({
          organizationId: orgId,
          todoId,
          status,
        });
        setTodos((prev) => prev.map((t) => (t.id === todoId ? updated : t)));
        setError(null);
      } catch (e) {
        if (snapshot) {
          const restore = snapshot;
          setTodos((prev) =>
            prev.map((t) => (t.id === todoId ? restore : t)),
          );
        }
        setError(e instanceof Error ? e.message : "Failed to update issue");
        throw e;
      }
    },
    [orgId],
  );

  const updateTodoTitle = useCallback(
    async (todoId: string, title: string) => {
      if (!orgId) return;
      const updated = await api.updateOrganizationProjectTodo({
        organizationId: orgId,
        todoId,
        title,
      });
      setTodos((prev) => prev.map((t) => (t.id === todoId ? updated : t)));
    },
    [orgId],
  );

  const deleteTodo = useCallback(
    async (todoId: string) => {
      if (!orgId) return;
      await api.deleteOrganizationProjectTodo(orgId, todoId);
      setTodos((prev) => prev.filter((t) => t.id !== todoId));
      setSelectedTodoId((prev) => (prev === todoId ? null : prev));
    },
    [orgId],
  );

  const addSubtask = useCallback(
    async (todoId: string, title: string) => {
      if (!orgId) return;
      const sub = await api.createSubtask(orgId, todoId, title);
      setTodos((prev) =>
        prev.map((t) =>
          t.id === todoId ? { ...t, subtasks: [...t.subtasks, sub] } : t,
        ),
      );
    },
    [orgId],
  );

  const toggleSubtask = useCallback(
    async (todoId: string, subtaskId: string, completed: boolean) => {
      if (!orgId) return;
      const sub = await api.updateSubtask(orgId, { id: subtaskId, completed });
      setTodos((prev) =>
        prev.map((t) =>
          t.id === todoId
            ? {
                ...t,
                subtasks: t.subtasks.map((s) =>
                  s.id === subtaskId ? sub : s,
                ),
              }
            : t,
        ),
      );
    },
    [orgId],
  );

  const deleteSubtask = useCallback(
    async (todoId: string, subtaskId: string) => {
      if (!orgId) return;
      await api.deleteSubtask(orgId, subtaskId);
      setTodos((prev) =>
        prev.map((t) =>
          t.id === todoId
            ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
            : t,
        ),
      );
    },
    [orgId],
  );

  const filteredTodos = useMemo(() => {
    const q = query.trim().toLowerCase();
    return todos
      .filter((t) => (statusFilter === "all" ? true : t.status === statusFilter))
      .filter((t) => (q ? t.title.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "OPEN" ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [todos, statusFilter, query]);

  const org = orgs.find((o) => o.id === orgId) ?? null;
  const project = projects.find((p) => p.id === projectId) ?? null;
  const selectedTodo = todos.find((t) => t.id === selectedTodoId) ?? null;

  const value = useMemo(
    () => ({
      orgs,
      projects,
      members,
      todos,
      orgId,
      projectId,
      org,
      project,
      viewMode,
      statusFilter,
      query,
      loading,
      error,
      selectedTodoId,
      selectedTodo,
      setOrgId,
      setProjectId,
      setViewMode,
      setStatusFilter,
      setQuery,
      setSelectedTodoId,
      refreshOrgs,
      refreshProjects,
      refreshTodos,
      createProject,
      createTodo,
      updateTodoStatus,
      updateTodoTitle,
      deleteTodo,
      addSubtask,
      toggleSubtask,
      deleteSubtask,
      filteredTodos,
    }),
    [
      orgs,
      projects,
      members,
      todos,
      orgId,
      projectId,
      org,
      project,
      viewMode,
      statusFilter,
      query,
      loading,
      error,
      selectedTodoId,
      selectedTodo,
      setOrgId,
      setProjectId,
      setViewMode,
      refreshOrgs,
      refreshProjects,
      refreshTodos,
      createProject,
      createTodo,
      updateTodoStatus,
      updateTodoTitle,
      deleteTodo,
      addSubtask,
      toggleSubtask,
      deleteSubtask,
      filteredTodos,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
