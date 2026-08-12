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
import { toast } from "sonner";
import { formatOperatorError } from "./operator-errors";
import { storage } from "./storage";
import { useAuth } from "./auth";
import type {
  AssigneeFilter,
  BoardColumn,
  OrgInvitation,
  OrgMember,
  Organization,
  OrganizationMessage,
  PersonalTodo,
  Project,
  ProjectMember,
  Purchase,
  PurchaseStatus,
  Sprint,
  SprintStatus,
  StatusFilter,
  Todo,
  TodoStatus,
  ViewMode,
  WorkspaceTab,
} from "./types";

const STAGE_TO_COLUMN: Record<
  "todo" | "doing" | "review" | "done",
  BoardColumn
> = {
  todo: "TODO",
  doing: "DOING",
  review: "REVIEW",
  done: "DONE",
};

interface CreateTodoInput {
  title: string;
  assignedToUserId?: string | null;
  dueAt?: string | null;
}

interface CreatePurchaseInput {
  productName: string;
  price: number;
  quantity?: number;
  taxRate?: number;
  productPurpose?: string;
  productLink?: string;
  currency?: string;
  status?: PurchaseStatus;
  statusNote?: string;
}

interface WorkspaceContextValue {
  orgs: Organization[];
  projects: Project[];
  members: ProjectMember[];
  orgMembers: OrgMember[];
  todos: Todo[];
  /** Org-wide issues across all projects (dashboard / projects panels). */
  orgTodos: Todo[];
  purchases: Purchase[];
  personalTodos: PersonalTodo[];
  invitations: OrgInvitation[];
  chatMessages: OrganizationMessage[];
  orgId: string | null;
  projectId: string | null;
  org: Organization | null;
  project: Project | null;
  tab: WorkspaceTab;
  viewMode: ViewMode;
  statusFilter: StatusFilter;
  assigneeFilter: AssigneeFilter;
  query: string;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  selectedTodoId: string | null;
  selectedTodo: Todo | null;
  selectedPersonalId: string | null;
  selectedPersonal: PersonalTodo | null;
  /** Bumped when a panel asks AppShell to open the create-issue dialog. */
  createIssueSignal: number;
  requestCreateIssue: () => void;
  setOrgId: (id: string | null) => void;
  setProjectId: (id: string | null) => void;
  setTab: (tab: WorkspaceTab) => void;
  setViewMode: (mode: ViewMode) => void;
  setStatusFilter: (f: StatusFilter) => void;
  setAssigneeFilter: (f: AssigneeFilter) => void;
  setQuery: (q: string) => void;
  setSelectedTodoId: (id: string | null) => void;
  setSelectedPersonalId: (id: string | null) => void;
  refreshOrgs: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  refreshTodos: () => Promise<void>;
  refreshOrgTodos: () => Promise<void>;
  refreshPurchases: () => Promise<void>;
  refreshPersonal: () => Promise<void>;
  refreshInvitations: () => Promise<void>;
  refreshChat: () => Promise<void>;
  postChatMessage: (body: string) => Promise<void>;
  createOrganization: (name: string) => Promise<Organization>;
  createProject: (name: string, description?: string) => Promise<Project>;
  renameProject: (name: string) => Promise<void>;
  deleteProject: () => Promise<void>;
  addProjectMember: (userId: string) => Promise<void>;
  removeProjectMember: (userId: string) => Promise<void>;
  inviteToOrg: (email: string) => Promise<void>;
  acceptInvite: (id: string) => Promise<void>;
  declineInvite: (id: string) => Promise<void>;
  createTodo: (input: CreateTodoInput) => Promise<Todo>;
  updateTodoStatus: (todoId: string, status: TodoStatus) => Promise<void>;
  /** Kanban column move → Particular `boardColumn` (+ status compat). */
  moveTodoToBoardStage: (
    todoId: string,
    stage: "todo" | "doing" | "review" | "done",
  ) => Promise<void>;
  updateTodoTitle: (todoId: string, title: string) => Promise<void>;
  updateTodoDue: (todoId: string, dueAt: string | null) => Promise<void>;
  updateTodoStoryPoints: (todoId: string, points: number | null) => Promise<void>;
  updateTodoDescription: (todoId: string, description: string) => Promise<void>;
  updateTodoSprint: (todoId: string, sprintId: string | null) => Promise<void>;
  sprints: Sprint[];
  refreshSprints: () => Promise<void>;
  createSprint: (input: {
    name: string;
    goal?: string;
    startsAt?: string | null;
    endsAt?: string | null;
    status?: SprintStatus;
  }) => Promise<Sprint>;
  updateSprintStatus: (sprintId: string, status: SprintStatus) => Promise<void>;
  deleteTodo: (todoId: string) => Promise<void>;
  addSubtask: (todoId: string, title: string) => Promise<void>;
  toggleSubtask: (todoId: string, subtaskId: string, completed: boolean) => Promise<void>;
  deleteSubtask: (todoId: string, subtaskId: string) => Promise<void>;
  createPurchase: (input: CreatePurchaseInput) => Promise<Purchase>;
  updatePurchaseStatus: (
    purchaseId: string,
    status: PurchaseStatus,
  ) => Promise<void>;
  deletePurchase: (purchaseId: string) => Promise<void>;
  createPersonalTodo: (title: string, dueAt?: string | null) => Promise<void>;
  togglePersonalTodo: (id: string, completed: boolean) => Promise<void>;
  deletePersonalTodo: (id: string) => Promise<void>;
  addPersonalSubtask: (todoId: string, title: string) => Promise<void>;
  togglePersonalSubtask: (
    todoId: string,
    subtaskId: string,
    completed: boolean,
  ) => Promise<void>;
  deletePersonalSubtask: (todoId: string, subtaskId: string) => Promise<void>;
  filteredTodos: Todo[];
  filteredPersonal: PersonalTodo[];
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [orgTodos, setOrgTodos] = useState<Todo[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [personalTodos, setPersonalTodos] = useState<PersonalTodo[]>([]);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [chatMessages, setChatMessages] = useState<OrganizationMessage[]>([]);
  const [orgId, setOrgIdState] = useState<string | null>(null);
  const [projectId, setProjectIdState] = useState<string | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("dashboard");
  const [viewMode, setViewModeState] = useState<ViewMode>("list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [selectedPersonalId, setSelectedPersonalId] = useState<string | null>(
    null,
  );
  const [createIssueSignal, setCreateIssueSignal] = useState(0);

  useEffect(() => {
    if (!user) {
      setOrgs([]);
      setProjects([]);
      setTodos([]);
      setOrgTodos([]);
      setMembers([]);
      setOrgMembers([]);
      setPurchases([]);
      setPersonalTodos([]);
      setInvitations([]);
      setChatMessages([]);
      setOrgIdState(null);
      setProjectIdState(null);
      return;
    }
    const savedView = storage.getViewMode();
    if (savedView === "list" || savedView === "board" || savedView === "timeline") {
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
    setAssigneeFilter("all");
  }, []);

  const setProjectId = useCallback((id: string | null) => {
    storage.setProjectId(id);
    setProjectIdState(id);
    setSelectedTodoId(null);
    setAssigneeFilter("all");
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    storage.setViewMode(mode);
    setViewModeState(mode);
  }, []);

  const refreshInvitations = useCallback(async () => {
    if (!user) return;
    try {
      const list = await api.myPendingInvitations();
      setInvitations(list);
    } catch {
      setInvitations([]);
    }
  }, [user]);

  const refreshOrgs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [list] = await Promise.all([
        api.myOrganizations(),
        refreshInvitations(),
      ]);
      setOrgs(list);
      setOrgIdState((prev) => {
        if (prev && list.some((o) => o.id === prev)) return prev;
        const next = list[0]?.id ?? null;
        storage.setOrgId(next);
        return next;
      });
    } catch (e) {
      setOrgs([]);
      // Drop in-memory selection so project/todo refreshes do not race-clear
      // this bootstrap error (localStorage ids stay for the next successful load).
      setOrgIdState(null);
      setProjectIdState(null);
      setProjects([]);
      setOrgMembers([]);
      setError(formatOperatorError(e, "Failed to load organizations"));
    } finally {
      setLoading(false);
    }
  }, [user, refreshInvitations]);

  const refreshProjects = useCallback(async () => {
    if (!orgId) {
      setProjects([]);
      setOrgMembers([]);
      return;
    }
    setLoading(true);
    try {
      const [list, membersList] = await Promise.all([
        api.organizationProjects(orgId),
        api.organizationMembers(orgId).catch(() => [] as OrgMember[]),
      ]);
      setProjects(list);
      setOrgMembers(membersList);
      setProjectIdState((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev;
        const next = list[0]?.id ?? null;
        storage.setProjectId(next);
        return next;
      });
    } catch (e) {
      setError(formatOperatorError(e, "Failed to load projects"));
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
    try {
      const [todoList, memberList] = await Promise.all([
        api.organizationProjectTodos(orgId, projectId),
        api.organizationProjectMembers(orgId, projectId),
      ]);
      setTodos(todoList);
      setMembers(memberList);
    } catch (e) {
      setError(formatOperatorError(e, "Failed to load issues"));
    } finally {
      setLoading(false);
    }
  }, [orgId, projectId]);

  const refreshOrgTodos = useCallback(async () => {
    if (!orgId || projects.length === 0) {
      setOrgTodos([]);
      return;
    }
    try {
      const lists = await Promise.all(
        projects.map((p) =>
          api.organizationProjectTodos(orgId, p.id).catch(() => [] as Todo[]),
        ),
      );
      setOrgTodos(lists.flat());
    } catch {
      /* keep prior orgTodos */
    }
  }, [orgId, projects]);

  const refreshPurchases = useCallback(async () => {
    if (!projectId || !orgId) {
      setPurchases([]);
      return;
    }
    try {
      const list = await api.organizationProjectPurchases(orgId, projectId);
      setPurchases(list);
      // Do not clear workspace error — a successful purchases fetch must not
      // wipe an org/bootstrap network failure from refreshOrgs.
    } catch (e) {
      setError(formatOperatorError(e, "Failed to load purchases"));
    }
  }, [orgId, projectId]);

  const refreshPersonal = useCallback(async () => {
    if (!user) return;
    try {
      const list = await api.myTodos();
      setPersonalTodos(list);
      // Do not clear workspace error — myTodos often succeeds while
      // myOrganizations failed (API partially reachable / route aborted).
    } catch (e) {
      setError(formatOperatorError(e, "Failed to load personal todos"));
    }
  }, [user]);

  useEffect(() => {
    void refreshOrgs();
  }, [refreshOrgs]);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    void refreshTodos();
  }, [refreshTodos]);

  useEffect(() => {
    if (
      tab === "dashboard" ||
      tab === "projects" ||
      tab === "team" ||
      tab === "sprints" ||
      tab === "reports"
    ) {
      void refreshOrgTodos();
    }
  }, [tab, refreshOrgTodos]);

  useEffect(() => {
    if (tab === "purchases" || tab === "dashboard") void refreshPurchases();
  }, [tab, refreshPurchases]);

  useEffect(() => {
    if (tab === "personal" || tab === "dashboard") void refreshPersonal();
  }, [tab, refreshPersonal]);

  const requestCreateIssue = useCallback(() => {
    // Ensure a project is selected so AppShell can open the create dialog.
    setProjectIdState((prev) => {
      if (prev && projects.some((p) => p.id === prev)) return prev;
      const next = projects[0]?.id ?? null;
      if (next) storage.setProjectId(next);
      return next;
    });
    setTab("backlog");
    setCreateIssueSignal((n) => n + 1);
  }, [projects]);

  const refreshChat = useCallback(async () => {
    if (!user || !orgId) {
      setChatMessages([]);
      return;
    }
    try {
      const list = await api.organizationMessages(orgId, 100);
      // API returns newest-first typically; keep chronological for chat UI.
      const sorted = [...list].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setChatMessages(sorted);
    } catch (e) {
      setError(formatOperatorError(e, "Failed to load chat"));
      setChatMessages([]);
    }
  }, [user, orgId]);

  useEffect(() => {
    if (tab === "chat" || tab === "dashboard") void refreshChat();
  }, [tab, refreshChat]);

  const postChatMessage = useCallback(
    async (body: string) => {
      if (!orgId) throw new Error("Select an organization first");
      const trimmed = body.trim();
      if (!trimmed) return;
      const msg = await api.postOrganizationMessage(orgId, trimmed);
      setChatMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
      );
    },
    [orgId],
  );

  const createOrganization = useCallback(
    async (name: string) => {
      try {
        const org = await api.createOrganization(name);
        setError(null);
        await refreshOrgs();
        setOrgId(org.id);
        toast.success("Organization created");
        return org;
      } catch (e) {
        const message = formatOperatorError(e, "Failed to create organization");
        setError(message);
        toast.error(message);
        throw e;
      }
    },
    [refreshOrgs, setOrgId],
  );

  const createProject = useCallback(
    async (name: string, description?: string) => {
      if (!orgId) throw new Error("Select an organization first");
      try {
        const project = await api.createOrganizationProject({
          organizationId: orgId,
          name,
          description,
        });
        setError(null);
        await refreshProjects();
        setProjectId(project.id);
        toast.success("Project created");
        return project;
      } catch (e) {
        const message = formatOperatorError(e, "Failed to create project");
        setError(message);
        toast.error(message);
        throw e;
      }
    },
    [orgId, refreshProjects, setProjectId],
  );

  const renameProject = useCallback(
    async (name: string) => {
      if (!orgId || !projectId) return;
      const updated = await api.updateOrganizationProject({
        organizationId: orgId,
        projectId,
        name,
      });
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? updated : p)),
      );
    },
    [orgId, projectId],
  );

  const deleteProject = useCallback(async () => {
    if (!orgId || !projectId) return;
    await api.deleteOrganizationProject(orgId, projectId);
    setProjectId(null);
    await refreshProjects();
  }, [orgId, projectId, refreshProjects, setProjectId]);

  const addProjectMember = useCallback(
    async (userId: string) => {
      if (!orgId || !projectId) return;
      await api.addOrganizationProjectMember(orgId, projectId, userId);
      await refreshTodos();
    },
    [orgId, projectId, refreshTodos],
  );

  const removeProjectMember = useCallback(
    async (userId: string) => {
      if (!orgId || !projectId) return;
      await api.removeOrganizationProjectMember(orgId, projectId, userId);
      await refreshTodos();
    },
    [orgId, projectId, refreshTodos],
  );

  const inviteToOrg = useCallback(
    async (email: string) => {
      if (!orgId) throw new Error("Select an organization first");
      await api.inviteToOrganization(orgId, email.trim());
    },
    [orgId],
  );

  const acceptInvite = useCallback(
    async (id: string) => {
      await api.acceptInvitation(id);
      await refreshOrgs();
    },
    [refreshOrgs],
  );

  const declineInvite = useCallback(
    async (id: string) => {
      await api.declineInvitation(id);
      await refreshInvitations();
    },
    [refreshInvitations],
  );

  const createTodo = useCallback(
    async (input: CreateTodoInput) => {
      if (!projectId || !orgId) throw new Error("Select a project first");
      try {
        const todo = await api.createOrganizationProjectTodo({
          organizationId: orgId,
          projectId,
          title: input.title,
          assignedToUserId: input.assignedToUserId,
          dueAt: input.dueAt,
        });
        setTodos((prev) => [todo, ...prev]);
        setOrgTodos((prev) => [todo, ...prev]);
        setSelectedTodoId(todo.id);
        setError(null);
        toast.success("Issue created");
        return todo;
      } catch (e) {
        const message = formatOperatorError(e, "Failed to create issue");
        setError(message);
        toast.error(message);
        throw e;
      }
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
      setOrgTodos((prev) =>
        prev.map((t) => (t.id === todoId ? { ...t, status } : t)),
      );
      try {
        const updated = await api.updateOrganizationProjectTodo({
          organizationId: orgId,
          todoId,
          status,
        });
        setTodos((prev) => prev.map((t) => (t.id === todoId ? updated : t)));
        setOrgTodos((prev) => prev.map((t) => (t.id === todoId ? updated : t)));
        setError(null);
        toast.success(status === "DONE" ? "Marked done" : "Reopened");
      } catch (e) {
        if (snapshot) {
          const restore = snapshot;
          setTodos((prev) =>
            prev.map((t) => (t.id === todoId ? restore : t)),
          );
          setOrgTodos((prev) =>
            prev.map((t) => (t.id === todoId ? restore : t)),
          );
        }
        const message = formatOperatorError(e, "Failed to update issue");
        setError(message);
        toast.error(message);
        throw e;
      }
    },
    [orgId],
  );

  const refreshSprints = useCallback(async () => {
    if (!orgId || !projectId) {
      setSprints([]);
      return;
    }
    try {
      const list = await api.listOrganizationProjectSprints(orgId, projectId);
      setSprints(list);
    } catch {
      setSprints([]);
    }
  }, [orgId, projectId]);

  useEffect(() => {
    void refreshSprints();
  }, [refreshSprints]);

  const createSprint = useCallback(
    async (input: {
      name: string;
      goal?: string;
      startsAt?: string | null;
      endsAt?: string | null;
      status?: SprintStatus;
    }) => {
      if (!orgId || !projectId) throw new Error("Select a project first");
      const sp = await api.createOrganizationProjectSprint({
        organizationId: orgId,
        projectId,
        ...input,
      });
      setSprints((prev) => [sp, ...prev]);
      toast.success("Sprint created");
      return sp;
    },
    [orgId, projectId],
  );

  const updateSprintStatus = useCallback(
    async (sprintId: string, status: SprintStatus) => {
      if (!orgId) return;
      const updated = await api.updateOrganizationProjectSprint({
        organizationId: orgId,
        sprintId,
        status,
      });
      setSprints((prev) =>
        prev.map((s) => (s.id === sprintId ? updated : s)),
      );
      toast.success(`Sprint marked ${status.toLowerCase()}`);
    },
    [orgId],
  );

  const moveTodoToBoardStage = useCallback(
    async (
      todoId: string,
      stage: "todo" | "doing" | "review" | "done",
    ) => {
      if (!orgId) return;
      const snapshot =
        todos.find((t) => t.id === todoId) ??
        orgTodos.find((t) => t.id === todoId);
      if (!snapshot) return;

      const column = STAGE_TO_COLUMN[stage];
      if (snapshot.boardColumn === column) return;

      const patchOptimistic = (t: Todo): Todo => ({
        ...t,
        boardColumn: column,
        status: column === "DONE" ? "DONE" : "OPEN",
      });

      setTodos((prev) =>
        prev.map((t) => (t.id === todoId ? patchOptimistic(t) : t)),
      );
      setOrgTodos((prev) =>
        prev.map((t) => (t.id === todoId ? patchOptimistic(t) : t)),
      );

      try {
        const updated = await api.updateOrganizationProjectTodo({
          organizationId: orgId,
          todoId,
          boardColumn: column,
        });
        setTodos((prev) => prev.map((t) => (t.id === todoId ? updated : t)));
        setOrgTodos((prev) => prev.map((t) => (t.id === todoId ? updated : t)));
        setError(null);
        toast.success(
          stage === "done"
            ? "Moved to Done"
            : stage === "review"
              ? "Moved to In Review"
              : stage === "doing"
                ? "Moved to In Progress"
                : "Moved to Todo",
        );
      } catch (e) {
        setTodos((prev) =>
          prev.map((t) => (t.id === todoId ? snapshot : t)),
        );
        setOrgTodos((prev) =>
          prev.map((t) => (t.id === todoId ? snapshot : t)),
        );
        const message = formatOperatorError(e, "Failed to move issue");
        setError(message);
        toast.error(message);
        throw e;
      }
    },
    [orgId, orgTodos, todos],
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
      setOrgTodos((prev) => prev.map((t) => (t.id === todoId ? updated : t)));
    },
    [orgId],
  );

  const updateTodoDue = useCallback(
    async (todoId: string, dueAt: string | null) => {
      if (!orgId) return;
      const updated = await api.updateOrganizationProjectTodo({
        organizationId: orgId,
        todoId,
        ...(dueAt ? { dueAt } : { clearDueAt: true }),
      });
      setTodos((prev) => prev.map((t) => (t.id === todoId ? updated : t)));
      setOrgTodos((prev) => prev.map((t) => (t.id === todoId ? updated : t)));
    },
    [orgId],
  );

  const updateTodoStoryPoints = useCallback(
    async (todoId: string, points: number | null) => {
      if (!orgId) return;
      const updated = await api.updateOrganizationProjectTodo({
        organizationId: orgId,
        todoId,
        ...(points === null
          ? { clearStoryPoints: true }
          : { storyPoints: points }),
      });
      setTodos((prev) => prev.map((t) => (t.id === todoId ? updated : t)));
      setOrgTodos((prev) => prev.map((t) => (t.id === todoId ? updated : t)));
      toast.success(points === null ? "Story points cleared" : `SP set to ${points}`);
    },
    [orgId],
  );

  const updateTodoDescription = useCallback(
    async (todoId: string, description: string) => {
      if (!orgId) return;
      const updated = await api.updateOrganizationProjectTodo({
        organizationId: orgId,
        todoId,
        description,
      });
      setTodos((prev) => prev.map((t) => (t.id === todoId ? updated : t)));
      setOrgTodos((prev) => prev.map((t) => (t.id === todoId ? updated : t)));
    },
    [orgId],
  );

  const updateTodoSprint = useCallback(
    async (todoId: string, sprintId: string | null) => {
      if (!orgId) return;
      const updated = await api.updateOrganizationProjectTodo({
        organizationId: orgId,
        todoId,
        ...(sprintId ? { sprintId } : { clearSprintId: true }),
      });
      setTodos((prev) => prev.map((t) => (t.id === todoId ? updated : t)));
      setOrgTodos((prev) => prev.map((t) => (t.id === todoId ? updated : t)));
      toast.success(sprintId ? "Added to sprint" : "Removed from sprint");
    },
    [orgId],
  );

  const deleteTodo = useCallback(
    async (todoId: string) => {
      if (!orgId) return;
      await api.deleteOrganizationProjectTodo(orgId, todoId);
      setTodos((prev) => prev.filter((t) => t.id !== todoId));
      setOrgTodos((prev) => prev.filter((t) => t.id !== todoId));
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

  const createPurchase = useCallback(
    async (input: CreatePurchaseInput) => {
      if (!orgId || !projectId) throw new Error("Select a project first");
      const purchase = await api.createOrganizationProjectPurchase({
        organizationId: orgId,
        projectId,
        ...input,
      });
      setPurchases((prev) => [purchase, ...prev]);
      return purchase;
    },
    [orgId, projectId],
  );

  const updatePurchaseStatus = useCallback(
    async (purchaseId: string, status: PurchaseStatus) => {
      if (!orgId) return;
      const current = purchases.find((p) => p.id === purchaseId);
      if (!current) return;
      const updated = await api.updateOrganizationProjectPurchase({
        organizationId: orgId,
        purchaseId,
        productName: current.productName,
        taxRate: current.taxRate,
        productPurpose: current.productPurpose,
        price: current.price,
        quantity: current.quantity,
        productLink: current.productLink,
        currency: current.currency,
        status,
        statusNote: current.statusNote,
      });
      setPurchases((prev) =>
        prev.map((p) => (p.id === purchaseId ? updated : p)),
      );
    },
    [orgId, purchases],
  );

  const deletePurchase = useCallback(
    async (purchaseId: string) => {
      if (!orgId) return;
      await api.deleteOrganizationProjectPurchase(orgId, purchaseId);
      setPurchases((prev) => prev.filter((p) => p.id !== purchaseId));
    },
    [orgId],
  );

  const createPersonalTodo = useCallback(
    async (title: string, dueAt?: string | null) => {
      const todo = await api.createPersonalTodo({
        title,
        dueAt: dueAt ?? null,
        organizationID: orgId,
      });
      setPersonalTodos((prev) => [{ ...todo, subtasks: [] }, ...prev]);
      setSelectedPersonalId(todo.id);
    },
    [orgId],
  );

  const togglePersonalTodo = useCallback(
    async (id: string, completed: boolean) => {
      const updated = await api.updatePersonalTodo({ id, completed });
      setPersonalTodos((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, ...updated, subtasks: t.subtasks } : t,
        ),
      );
    },
    [],
  );

  const deletePersonalTodo = useCallback(async (id: string) => {
    await api.deletePersonalTodo(id);
    setPersonalTodos((prev) => prev.filter((t) => t.id !== id));
    setSelectedPersonalId((prev) => (prev === id ? null : prev));
  }, []);

  const addPersonalSubtask = useCallback(
    async (todoId: string, title: string) => {
      const sub = await api.createPersonalSubtask(todoId, title);
      setPersonalTodos((prev) =>
        prev.map((t) =>
          t.id === todoId ? { ...t, subtasks: [...t.subtasks, sub] } : t,
        ),
      );
    },
    [],
  );

  const togglePersonalSubtask = useCallback(
    async (todoId: string, subtaskId: string, completed: boolean) => {
      const sub = await api.updatePersonalSubtask({ id: subtaskId, completed });
      setPersonalTodos((prev) =>
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
    [],
  );

  const deletePersonalSubtask = useCallback(
    async (todoId: string, subtaskId: string) => {
      await api.deletePersonalSubtask(subtaskId);
      setPersonalTodos((prev) =>
        prev.map((t) =>
          t.id === todoId
            ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
            : t,
        ),
      );
    },
    [],
  );

  const filteredTodos = useMemo(() => {
    const q = query.trim().toLowerCase();
    const myId = user?.id;
    return todos
      .filter((t) => (statusFilter === "all" ? true : t.status === statusFilter))
      .filter((t) => {
        if (assigneeFilter === "all") return true;
        if (assigneeFilter === "me") return t.assignedToUserId === myId;
        if (assigneeFilter === "unassigned") return !t.assignedToUserId;
        if (assigneeFilter.startsWith("member:")) {
          return t.assignedToUserId === assigneeFilter.slice("member:".length);
        }
        return true;
      })
      .filter((t) => (q ? t.title.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "OPEN" ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [todos, statusFilter, assigneeFilter, query, user?.id]);

  const filteredPersonal = useMemo(() => {
    const q = query.trim().toLowerCase();
    return personalTodos
      .filter((t) => {
        if (statusFilter === "OPEN") return !t.completed;
        if (statusFilter === "DONE") return t.completed;
        return true;
      })
      .filter((t) => (q ? t.title.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [personalTodos, statusFilter, query]);

  const org = orgs.find((o) => o.id === orgId) ?? null;
  const project = projects.find((p) => p.id === projectId) ?? null;
  // Fall back to org-wide cache so Dashboard → cross-project open still
  // resolves while project todos are loading.
  const selectedTodo =
    todos.find((t) => t.id === selectedTodoId) ??
    orgTodos.find((t) => t.id === selectedTodoId) ??
    null;
  const selectedPersonal =
    personalTodos.find((t) => t.id === selectedPersonalId) ?? null;

  const value = useMemo(
    () => ({
      orgs,
      projects,
      members,
      orgMembers,
      todos,
      orgTodos,
      sprints,
      purchases,
      personalTodos,
      invitations,
      chatMessages,
      orgId,
      projectId,
      org,
      project,
      tab,
      viewMode,
      statusFilter,
      assigneeFilter,
      query,
      loading,
      error,
      clearError: () => setError(null),
      selectedTodoId,
      selectedTodo,
      selectedPersonalId,
      selectedPersonal,
      createIssueSignal,
      requestCreateIssue,
      setOrgId,
      setProjectId,
      setTab,
      setViewMode,
      setStatusFilter,
      setAssigneeFilter,
      setQuery,
      setSelectedTodoId,
      setSelectedPersonalId,
      refreshOrgs,
      refreshProjects,
      refreshTodos,
      refreshOrgTodos,
      refreshSprints,
      refreshPurchases,
      refreshPersonal,
      refreshInvitations,
      refreshChat,
      postChatMessage,
      createOrganization,
      createProject,
      renameProject,
      deleteProject,
      addProjectMember,
      removeProjectMember,
      inviteToOrg,
      acceptInvite,
      declineInvite,
      createTodo,
      updateTodoStatus,
      moveTodoToBoardStage,
      updateTodoTitle,
      updateTodoDue,
      updateTodoStoryPoints,
      updateTodoDescription,
      updateTodoSprint,
      createSprint,
      updateSprintStatus,
      deleteTodo,
      addSubtask,
      toggleSubtask,
      deleteSubtask,
      createPurchase,
      updatePurchaseStatus,
      deletePurchase,
      createPersonalTodo,
      togglePersonalTodo,
      deletePersonalTodo,
      addPersonalSubtask,
      togglePersonalSubtask,
      deletePersonalSubtask,
      filteredTodos,
      filteredPersonal,
    }),
    [
      orgs,
      projects,
      members,
      orgMembers,
      todos,
      orgTodos,
      sprints,
      purchases,
      personalTodos,
      invitations,
      chatMessages,
      orgId,
      projectId,
      org,
      project,
      tab,
      viewMode,
      statusFilter,
      assigneeFilter,
      query,
      loading,
      error,
      selectedTodoId,
      selectedTodo,
      selectedPersonalId,
      selectedPersonal,
      createIssueSignal,
      requestCreateIssue,
      setOrgId,
      setProjectId,
      setViewMode,
      refreshOrgs,
      refreshProjects,
      refreshTodos,
      refreshOrgTodos,
      refreshSprints,
      refreshPurchases,
      refreshPersonal,
      refreshInvitations,
      refreshChat,
      postChatMessage,
      createOrganization,
      createProject,
      renameProject,
      deleteProject,
      addProjectMember,
      removeProjectMember,
      inviteToOrg,
      acceptInvite,
      declineInvite,
      createTodo,
      updateTodoStatus,
      moveTodoToBoardStage,
      updateTodoTitle,
      updateTodoDue,
      updateTodoStoryPoints,
      updateTodoDescription,
      updateTodoSprint,
      createSprint,
      updateSprintStatus,
      deleteTodo,
      addSubtask,
      toggleSubtask,
      deleteSubtask,
      createPurchase,
      updatePurchaseStatus,
      deletePurchase,
      createPersonalTodo,
      togglePersonalTodo,
      deletePersonalTodo,
      addPersonalSubtask,
      togglePersonalSubtask,
      deletePersonalSubtask,
      filteredTodos,
      filteredPersonal,
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
