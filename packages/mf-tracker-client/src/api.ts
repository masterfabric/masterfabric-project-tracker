import { getClientConfig } from "./config";
import { graphqlRequest, GraphQLError } from "./graphql";
import { isPersonalTodoSchemaMismatchError } from "./operator-errors";
import type {
  AuthSession,
  AuthUser,
  BoardColumn,
  BoardProcessPack,
  BoardStage,
  LoginResult,
  OrgInvitation,
  OrgMember,
  Organization,
  OrganizationMessage,
  PersonalTodo,
  PersonalTodoSubtask,
  Project,
  ProjectMember,
  Purchase,
  PurchaseStatus,
  Sprint,
  SprintStatus,
  Todo,
  TodoActivity,
  TodoComment,
  TodoLink,
  TodoLinkKind,
  TodoPriority,
  TodoStatus,
  TodoSubtask,
  TodoTimeEntry,
  TodoTimerKind,
  TodoWatcher,
  ProjectLabel,
  ProjectRelease,
  ReleaseStatus,
  ProjectMemberRole,
  WorkflowStatus,
  WorkflowStatusCategory,
  CustomField,
  CustomFieldType,
  CustomFieldValue,
  IssueTemplate,
  NotificationKind,
  OrgTeam,
  OrgTeamMember,
  PriorityStat,
  ProjectComponent,
  ProjectNotification,
  ProjectReport,
  ReportKind,
  ReportResult,
  SprintIncompleteMove,
  SlaPolicy,
  TodoAttachment,
} from "./types";

const PROJECT_TRACKER_CAPABILITY = "project.tracker.graphql";

function particularKey(): string {
  return getClientConfig().particularKey || "project_tracker";
}

type EnvelopeResult = {
  particularGraphqlEnvelope: {
    dataJson?: string | null;
    errorsJson?: string | null;
  };
};

async function projectTrackerEnvelope<T>(args: {
  organizationId: string;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> {
  const organizationId = args.organizationId?.trim();
  if (!organizationId) {
    throw new Error("organizationId is required for project tracker calls");
  }

  const data = await graphqlRequest<EnvelopeResult>(
    `query ParticularGraphqlEnvelope($input: ParticularGraphqlInput!) {
      particularGraphqlEnvelope(input: $input) {
        dataJson
        errorsJson
      }
    }`,
    {
      input: {
        particularKey: particularKey(),
        organizationId,
        requiredCapability: PROJECT_TRACKER_CAPABILITY,
        query: args.query,
        variablesJson: JSON.stringify(args.variables ?? {}),
      },
    },
  );

  const env = data.particularGraphqlEnvelope;
  if (env.errorsJson && env.errorsJson !== "null" && env.errorsJson !== "[]") {
    throw new Error(`project_tracker errors: ${env.errorsJson}`);
  }
  if (!env.dataJson) {
    throw new Error("project_tracker returned empty dataJson");
  }

  const parsed = JSON.parse(env.dataJson) as { data?: T } | T;
  if (
    parsed &&
    typeof parsed === "object" &&
    "data" in parsed &&
    parsed.data !== undefined
  ) {
    return parsed.data as T;
  }
  return parsed as T;
}

const TODO_FIELDS = `
  id projectId title status boardColumn boardStageId workflowStatusId priority storyPoints description sprintId rank
  createdByUserId reporterUserId assignedToUserId developerUserId testerUserId reviewerUserId
  dueAt estimateAt testDueAt testEstimateSeconds
  timeSpentSeconds testTimeSpentSeconds devTimeSpentSeconds
  parentTodoId fixVersionId teamId effectiveTeamId priorityRank slaDueAt slaBreached
  createdAt updatedAt
  subtasks { id projectTodoId title completed sortOrder createdAt updatedAt }
  timeEntries { id todoId userId kind startedAt endedAt durationSeconds createdAt }
  labels { id projectId name color createdAt updatedAt }
  comments { id todoId authorUserId body createdAt updatedAt }
  links { id fromTodoId toTodoId kind createdAt }
  watchers { todoId userId addedAt }
  attachments { id todoId uploadedByUserId filename contentType sizeBytes url storageKey createdAt }
  customFieldValues { todoId fieldId valueJson updatedAt }
  components { id projectId name description leadUserId createdAt updatedAt }
`;

const TODO_FIELDS_AGILE = `
  id projectId title status boardColumn priority storyPoints description sprintId rank
  createdByUserId assignedToUserId dueAt createdAt updatedAt
  subtasks { id projectTodoId title completed sortOrder createdAt updatedAt }
`;

const TODO_FIELDS_LEGACY = `
  id projectId title status createdByUserId assignedToUserId dueAt
  createdAt updatedAt
  subtasks { id projectTodoId title completed sortOrder createdAt updatedAt }
`;

function inferBoardColumn(
  raw: Partial<Todo> & { status?: TodoStatus; assignedToUserId?: string | null },
): BoardColumn {
  if (raw.boardColumn) return raw.boardColumn;
  if (raw.status === "DONE") return "DONE";
  if (raw.assignedToUserId) return "DOING";
  return "TODO";
}

/** Older Particular schemas lack boardColumn / SP / sprint fields. */
function isAgileTodoSchemaMismatchError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const mentionsField =
    /boardcolumn|storypoints|sprintid|clearsprintid|clearstorypoints|\brank\b|priority|clearpriority|workflowstatus|reporteruserid|developeruserid|testeruserid|revieweruserid|estimateat|testdueat|testestimateseconds|timespent|boardstageid|timeentries|mapstoboardcolumn|issystem|parenttodoid|fixversionid|\blabels\b|\bcomments\b|\blinks\b|\bwatchers\b|attachments|customfield|components|sladue|teamid|priorityrank|capacitypoints|committedpoints/.test(
      msg,
    );
  const looksLikeValidation =
    /unknown field|cannot query field|unknown argument|unknown type|graphql_validation|validation error|got invalid value/.test(
      msg,
    );
  return mentionsField && looksLikeValidation;
}

function normalizeTodo(
  raw: Todo & {
    subtasks?: TodoSubtask[] | null;
    boardColumn?: BoardColumn | null;
    storyPoints?: number | null;
    description?: string | null;
    sprintId?: string | null;
    rank?: number | null;
    timeEntries?: TodoTimeEntry[] | null;
    labels?: ProjectLabel[] | null;
    comments?: TodoComment[] | null;
    links?: TodoLink[] | null;
    watchers?: TodoWatcher[] | null;
  },
): Todo {
  return {
    ...raw,
    boardColumn: inferBoardColumn(raw),
    boardStageId: raw.boardStageId ?? null,
    workflowStatusId: raw.workflowStatusId ?? null,
    priority: raw.priority ?? "NONE",
    storyPoints: raw.storyPoints ?? null,
    description: raw.description ?? "",
    sprintId: raw.sprintId ?? null,
    rank: typeof raw.rank === "number" ? raw.rank : 0,
    reporterUserId: raw.reporterUserId ?? raw.createdByUserId ?? null,
    assignedToUserId: raw.assignedToUserId ?? null,
    developerUserId: raw.developerUserId ?? null,
    testerUserId: raw.testerUserId ?? null,
    reviewerUserId: raw.reviewerUserId ?? null,
    dueAt: raw.dueAt ?? null,
    estimateAt: raw.estimateAt ?? null,
    testDueAt: raw.testDueAt ?? null,
    testEstimateSeconds: raw.testEstimateSeconds ?? null,
    timeSpentSeconds: raw.timeSpentSeconds ?? 0,
    testTimeSpentSeconds: raw.testTimeSpentSeconds ?? 0,
    devTimeSpentSeconds: raw.devTimeSpentSeconds ?? 0,
    parentTodoId: raw.parentTodoId ?? null,
    fixVersionId: raw.fixVersionId ?? null,
    teamId: raw.teamId ?? null,
    effectiveTeamId: raw.effectiveTeamId ?? raw.teamId ?? null,
    priorityRank: raw.priorityRank ?? 0,
    slaDueAt: raw.slaDueAt ?? null,
    slaBreached: Boolean(raw.slaBreached),
    subtasks: raw.subtasks ?? [],
    timeEntries: raw.timeEntries ?? [],
    labels: raw.labels ?? [],
    comments: raw.comments ?? [],
    links: raw.links ?? [],
    watchers: raw.watchers ?? [],
    attachments: raw.attachments ?? [],
    customFieldValues: raw.customFieldValues ?? [],
    components: raw.components ?? [],
  };
}

function normalizeSprint(raw: Sprint): Sprint {
  return {
    ...raw,
    goal: raw.goal ?? "",
    startsAt: raw.startsAt ?? null,
    endsAt: raw.endsAt ?? null,
    retroNotes: raw.retroNotes ?? "",
    capacityPoints: raw.capacityPoints ?? null,
    maxIssues: raw.maxIssues ?? null,
    committedPoints: raw.committedPoints ?? 0,
    completedPoints: raw.completedPoints ?? 0,
    issueCount: raw.issueCount ?? 0,
    completedIssueCount: raw.completedIssueCount ?? 0,
  };
}

function inferMapsToBoardColumn(columnKey: string | undefined): BoardColumn {
  switch ((columnKey ?? "").toUpperCase()) {
    case "DOING":
      return "DOING";
    case "REVIEW":
      return "REVIEW";
    case "DONE":
      return "DONE";
    default:
      return "TODO";
  }
}

function normalizeBoardStage(raw: BoardStage): BoardStage {
  return {
    ...raw,
    label: raw.label ?? raw.columnKey,
    sortOrder: raw.sortOrder ?? 0,
    active: Boolean(raw.active),
    wipLimit: raw.wipLimit ?? null,
    mapsToBoardColumn: raw.mapsToBoardColumn ?? inferMapsToBoardColumn(raw.columnKey),
    isSystem: Boolean(raw.isSystem),
  };
}

function normalizePurchase(
  raw: Purchase & { productLink?: string | null },
): Purchase {
  return {
    ...raw,
    productLink: raw.productLink ?? null,
    taxRate: raw.taxRate ?? 0,
    productPurpose: raw.productPurpose ?? "",
    quantity: raw.quantity ?? 1,
    statusNote: raw.statusNote ?? "",
    currency: raw.currency || "USD",
  };
}

function normalizePersonal(
  raw: PersonalTodo & { subtasks?: PersonalTodoSubtask[] | null },
): PersonalTodo {
  return {
    ...raw,
    organizationID: raw.organizationID ?? null,
    assignedToUserID: raw.assignedToUserID ?? null,
    dueAt: raw.dueAt ?? null,
    subtasks: raw.subtasks ?? [],
  };
}

export const api = {
  login: (email: string, password: string) =>
    graphqlRequest<{ login: LoginResult }>(
      `mutation Login($input: LoginInput!) {
        login(input: $input) {
          otpRequired
          loginToken
          accessToken
          refreshToken
          expiresIn
          user { id email displayName avatarURL role }
        }
      }`,
      { input: { email, password } },
      { skipAuth: true },
    ).then((r) => r.login),

  loginVerifyOTP: (loginToken: string, code: string) =>
    graphqlRequest<{ loginVerifyOTP: AuthSession }>(
      `mutation LoginVerifyOTP($input: LoginVerifyOTPInput!) {
        loginVerifyOTP(input: $input) {
          accessToken refreshToken expiresIn
          user { id email displayName avatarURL role }
        }
      }`,
      { input: { loginToken, code } },
      { skipAuth: true },
    ).then((r) => r.loginVerifyOTP),

  register: (email: string, password: string, displayName: string) =>
    graphqlRequest<{ register: AuthSession }>(
      `mutation Register($input: RegisterInput!) {
        register(input: $input) {
          accessToken refreshToken expiresIn
          user { id email displayName avatarURL role }
        }
      }`,
      { input: { email, password, displayName } },
      { skipAuth: true },
    ).then((r) => r.register),

  me: () =>
    graphqlRequest<{
      me: {
        id: string;
        email: string;
        displayName: string;
        avatarURL: string;
        role: string;
      };
    }>(
      `query Me {
        me { id email displayName avatarURL role }
      }`,
    ).then((r) => r.me as AuthUser),

  myOrganizations: () =>
    graphqlRequest<{ myOrganizations: Organization[] }>(
      `query MyOrganizations {
        myOrganizations { id name description logoURL }
      }`,
    ).then((r) => r.myOrganizations),

  createOrganization: (name: string) =>
    graphqlRequest<{ createOrganization: Organization }>(
      `mutation CreateOrganization($input: CreateOrganizationInput!) {
        createOrganization(input: $input) {
          id name description logoURL
        }
      }`,
      { input: { name } },
    ).then((r) => r.createOrganization),

  organizationMembers: (orgId: string) =>
    graphqlRequest<{ organizationMembers: OrgMember[] }>(
      `query OrganizationMembers($orgId: UUID!) {
        organizationMembers(orgId: $orgId) {
          id organizationID userID userNickname userDisplayName userEmail
          role membershipStatus joinedAt
        }
      }`,
      { orgId },
    ).then((r) => r.organizationMembers),

  myPendingInvitations: () =>
    graphqlRequest<{ myPendingInvitations: OrgInvitation[] }>(
      `query MyPendingInvitations {
        myPendingInvitations {
          id organizationID inviterID inviteeEmail status createdAt
          organizationName inviterNickname
        }
      }`,
    ).then((r) => r.myPendingInvitations),

  inviteToOrganization: (organizationId: string, inviteeEmail: string) =>
    graphqlRequest<{ inviteToOrganization: OrgInvitation }>(
      `mutation InviteToOrganization($input: InviteToOrganizationInput!) {
        inviteToOrganization(input: $input) {
          id organizationID inviterID inviteeEmail status createdAt
        }
      }`,
      { input: { organizationId, inviteeEmail } },
    ).then((r) => r.inviteToOrganization),

  acceptInvitation: (invitationId: string) =>
    graphqlRequest<{ acceptInvitation: OrgInvitation }>(
      `mutation AcceptInvitation($invitationId: UUID!) {
        acceptInvitation(invitationId: $invitationId) {
          id organizationID inviterID inviteeEmail status createdAt
        }
      }`,
      { invitationId },
    ).then((r) => r.acceptInvitation),

  declineInvitation: (invitationId: string) =>
    graphqlRequest<{ declineInvitation: OrgInvitation }>(
      `mutation DeclineInvitation($invitationId: UUID!) {
        declineInvitation(invitationId: $invitationId) {
          id organizationID inviterID inviteeEmail status createdAt
        }
      }`,
      { invitationId },
    ).then((r) => r.declineInvitation),

  organizationProjects: (organizationId: string) =>
    projectTrackerEnvelope<{ organizationProjects: Project[] }>({
      organizationId,
      query: `query OrganizationProjects($organizationId: String!) {
        organizationProjects(organizationId: $organizationId) {
          id organizationId name description createdByUserId teamId issueSort createdAt updatedAt
        }
      }`,
      variables: { organizationId },
    }).then((r) => r.organizationProjects),

  createOrganizationProject: (input: {
    organizationId: string;
    name: string;
    description?: string;
  }) =>
    projectTrackerEnvelope<{ createOrganizationProject: Project }>({
      organizationId: input.organizationId,
      query: `mutation CreateOrganizationProject($input: CreateOrganizationProjectInput!) {
        createOrganizationProject(input: $input) {
          id organizationId name description createdByUserId createdAt updatedAt
        }
      }`,
      variables: { input },
    }).then((r) => r.createOrganizationProject),

  updateOrganizationProject: (input: {
    organizationId: string;
    projectId: string;
    name?: string;
    description?: string;
  }) =>
    projectTrackerEnvelope<{ updateOrganizationProject: Project }>({
      organizationId: input.organizationId,
      query: `mutation UpdateOrganizationProject($input: UpdateOrganizationProjectInput!) {
        updateOrganizationProject(input: $input) {
          id organizationId name description createdByUserId createdAt updatedAt
        }
      }`,
      variables: {
        input: {
          projectId: input.projectId,
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
        },
      },
    }).then((r) => r.updateOrganizationProject),

  deleteOrganizationProject: (organizationId: string, projectId: string) =>
    projectTrackerEnvelope<{ deleteOrganizationProject: boolean }>({
      organizationId,
      query: `mutation DeleteOrganizationProject($projectId: String!) {
        deleteOrganizationProject(projectId: $projectId)
      }`,
      variables: { projectId },
    }).then((r) => r.deleteOrganizationProject),

  organizationProjectMembers: (organizationId: string, projectId: string) =>
    projectTrackerEnvelope<{ organizationProjectMembers: ProjectMember[] }>({
      organizationId,
      query: `query OrganizationProjectMembers($projectId: String!) {
        organizationProjectMembers(projectId: $projectId) {
          id projectId userId userNickname role addedAt
        }
      }`,
      variables: { projectId },
    }).then((r) =>
      r.organizationProjectMembers.map((m) => ({
        ...m,
        role: m.role === "LEAD" ? "LEAD" : "MEMBER",
      })),
    ),

  addOrganizationProjectMember: (
    organizationId: string,
    projectId: string,
    userId: string,
  ) =>
    projectTrackerEnvelope<{ addOrganizationProjectMember: boolean }>({
      organizationId,
      query: `mutation AddOrganizationProjectMember($projectId: String!, $userId: String!) {
        addOrganizationProjectMember(projectId: $projectId, userId: $userId)
      }`,
      variables: { projectId, userId },
    }).then((r) => r.addOrganizationProjectMember),

  updateOrganizationProjectMemberRole: (
    organizationId: string,
    projectId: string,
    userId: string,
    role: ProjectMemberRole,
  ) =>
    projectTrackerEnvelope<{
      updateOrganizationProjectMemberRole: ProjectMember;
    }>({
      organizationId,
      query: `mutation UpdateOrganizationProjectMemberRole($projectId: String!, $userId: String!, $role: OrganizationProjectMemberRole!) {
        updateOrganizationProjectMemberRole(projectId: $projectId, userId: $userId, role: $role) {
          id projectId userId userNickname role addedAt
        }
      }`,
      variables: { projectId, userId, role },
    }).then((r) => ({
      ...r.updateOrganizationProjectMemberRole,
      role: r.updateOrganizationProjectMemberRole.role ?? "MEMBER",
    })),

  removeOrganizationProjectMember: (
    organizationId: string,
    projectId: string,
    userId: string,
  ) =>
    projectTrackerEnvelope<{ removeOrganizationProjectMember: boolean }>({
      organizationId,
      query: `mutation RemoveOrganizationProjectMember($projectId: String!, $userId: String!) {
        removeOrganizationProjectMember(projectId: $projectId, userId: $userId)
      }`,
      variables: { projectId, userId },
    }).then((r) => r.removeOrganizationProjectMember),

  organizationProjectTodos: async (organizationId: string, projectId: string) => {
    try {
      const r = await projectTrackerEnvelope<{
        organizationProjectTodos: Todo[];
      }>({
        organizationId,
        query: `query OrganizationProjectTodos($projectId: String!) {
          organizationProjectTodos(projectId: $projectId) { ${TODO_FIELDS} }
        }`,
        variables: { projectId },
      });
      return r.organizationProjectTodos.map(normalizeTodo);
    } catch (err) {
      // Only degrade the selection set on schema skew — never on auth/network.
      if (!isAgileTodoSchemaMismatchError(err)) throw err;
      try {
        const r = await projectTrackerEnvelope<{
          organizationProjectTodos: Todo[];
        }>({
          organizationId,
          query: `query OrganizationProjectTodosAgile($projectId: String!) {
            organizationProjectTodos(projectId: $projectId) { ${TODO_FIELDS_AGILE} }
          }`,
          variables: { projectId },
        });
        return r.organizationProjectTodos.map(normalizeTodo);
      } catch (legacyErr) {
        if (!isAgileTodoSchemaMismatchError(legacyErr)) throw legacyErr;
        const r = await projectTrackerEnvelope<{
          organizationProjectTodos: Todo[];
        }>({
          organizationId,
          query: `query OrganizationProjectTodosNoSubtasks($projectId: String!) {
            organizationProjectTodos(projectId: $projectId) {
              id projectId title status createdByUserId assignedToUserId dueAt
              createdAt updatedAt
            }
          }`,
          variables: { projectId },
        });
        return r.organizationProjectTodos.map(normalizeTodo);
      }
    }
  },

  createOrganizationProjectTodo: (input: {
    organizationId: string;
    projectId: string;
    title: string;
    assignedToUserId?: string | null;
    reporterUserId?: string | null;
    developerUserId?: string | null;
    testerUserId?: string | null;
    reviewerUserId?: string | null;
    dueAt?: string | null;
    estimateAt?: string | null;
    testDueAt?: string | null;
    testEstimateSeconds?: number | null;
    priority?: TodoPriority;
    workflowStatusId?: string | null;
    boardStageId?: string | null;
    parentTodoId?: string | null;
    fixVersionId?: string | null;
  }) =>
    projectTrackerEnvelope<{ createOrganizationProjectTodo: Todo }>({
      organizationId: input.organizationId,
      query: `mutation CreateOrganizationProjectTodo($input: CreateOrganizationProjectTodoInput!) {
        createOrganizationProjectTodo(input: $input) { ${TODO_FIELDS} }
      }`,
      variables: {
        input: {
          projectId: input.projectId,
          title: input.title,
          ...(input.assignedToUserId
            ? { assignedToUserId: input.assignedToUserId }
            : {}),
          ...(input.dueAt ? { dueAt: input.dueAt } : {}),
          ...(input.estimateAt ? { estimateAt: input.estimateAt } : {}),
          ...(input.testDueAt ? { testDueAt: input.testDueAt } : {}),
          ...(input.testEstimateSeconds != null
            ? { testEstimateSeconds: input.testEstimateSeconds }
            : {}),
          ...(input.reporterUserId ? { reporterUserId: input.reporterUserId } : {}),
          ...(input.developerUserId ? { developerUserId: input.developerUserId } : {}),
          ...(input.testerUserId ? { testerUserId: input.testerUserId } : {}),
          ...(input.reviewerUserId ? { reviewerUserId: input.reviewerUserId } : {}),
          ...(input.workflowStatusId ? { workflowStatusId: input.workflowStatusId } : {}),
          ...(input.boardStageId ? { boardStageId: input.boardStageId } : {}),
          ...(input.parentTodoId ? { parentTodoId: input.parentTodoId } : {}),
          ...(input.fixVersionId ? { fixVersionId: input.fixVersionId } : {}),
          ...(input.priority && input.priority !== "NONE"
            ? { priority: input.priority }
            : {}),
        },
      },
    })
      .then((r) => normalizeTodo(r.createOrganizationProjectTodo))
      .catch(async (err) => {
        if (!isAgileTodoSchemaMismatchError(err)) throw err;
        const r = await projectTrackerEnvelope<{
          createOrganizationProjectTodo: Todo;
        }>({
          organizationId: input.organizationId,
          query: `mutation CreateOrganizationProjectTodoLegacy($input: CreateOrganizationProjectTodoInput!) {
            createOrganizationProjectTodo(input: $input) { ${TODO_FIELDS_LEGACY} }
          }`,
          variables: {
            input: {
              projectId: input.projectId,
              title: input.title,
              ...(input.assignedToUserId
                ? { assignedToUserId: input.assignedToUserId }
                : {}),
              ...(input.dueAt ? { dueAt: input.dueAt } : {}),
            },
          },
        });
        return normalizeTodo(r.createOrganizationProjectTodo);
      }),

  updateOrganizationProjectTodo: (input: {
    organizationId: string;
    todoId: string;
    title?: string;
    status?: TodoStatus;
    boardColumn?: BoardColumn;
    storyPoints?: number | null;
    clearStoryPoints?: boolean;
    description?: string;
    sprintId?: string | null;
    clearSprintId?: boolean;
    rank?: number;
    dueAt?: string | null;
    clearDueAt?: boolean;
    assignedToUserId?: string | null;
    clearAssignedToUserId?: boolean;
    reporterUserId?: string | null;
    clearReporterUserId?: boolean;
    developerUserId?: string | null;
    clearDeveloperUserId?: boolean;
    testerUserId?: string | null;
    clearTesterUserId?: boolean;
    reviewerUserId?: string | null;
    clearReviewerUserId?: boolean;
    estimateAt?: string | null;
    clearEstimateAt?: boolean;
    testDueAt?: string | null;
    clearTestDueAt?: boolean;
    testEstimateSeconds?: number | null;
    clearTestEstimate?: boolean;
    workflowStatusId?: string | null;
    boardStageId?: string | null;
    clearBoardStageId?: boolean;
    priority?: TodoPriority;
    clearPriority?: boolean;
    parentTodoId?: string | null;
    clearParentTodoId?: boolean;
    fixVersionId?: string | null;
    clearFixVersionId?: boolean;
  }) => {
    const variablesInput: Record<string, unknown> = {
      todoId: input.todoId,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.boardColumn !== undefined
        ? { boardColumn: input.boardColumn }
        : {}),
      ...(input.storyPoints !== undefined && input.storyPoints !== null
        ? { storyPoints: input.storyPoints }
        : {}),
      ...(input.clearStoryPoints ? { clearStoryPoints: true } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.sprintId ? { sprintId: input.sprintId } : {}),
      ...(input.clearSprintId ? { clearSprintId: true } : {}),
      ...(input.rank !== undefined ? { rank: input.rank } : {}),
      ...(input.dueAt !== undefined && input.dueAt !== null
        ? { dueAt: input.dueAt }
        : {}),
      ...(input.clearDueAt ? { clearDueAt: true } : {}),
      ...(input.assignedToUserId
        ? { assignedToUserId: input.assignedToUserId }
        : {}),
      ...(input.clearAssignedToUserId
        ? { clearAssignedToUserId: true }
        : {}),
      ...(input.reporterUserId ? { reporterUserId: input.reporterUserId } : {}),
      ...(input.clearReporterUserId ? { clearReporterUserId: true } : {}),
      ...(input.developerUserId ? { developerUserId: input.developerUserId } : {}),
      ...(input.clearDeveloperUserId ? { clearDeveloperUserId: true } : {}),
      ...(input.testerUserId ? { testerUserId: input.testerUserId } : {}),
      ...(input.clearTesterUserId ? { clearTesterUserId: true } : {}),
      ...(input.reviewerUserId ? { reviewerUserId: input.reviewerUserId } : {}),
      ...(input.clearReviewerUserId ? { clearReviewerUserId: true } : {}),
      ...(input.estimateAt ? { estimateAt: input.estimateAt } : {}),
      ...(input.clearEstimateAt ? { clearEstimateAt: true } : {}),
      ...(input.testDueAt ? { testDueAt: input.testDueAt } : {}),
      ...(input.clearTestDueAt ? { clearTestDueAt: true } : {}),
      ...(input.testEstimateSeconds != null
        ? { testEstimateSeconds: input.testEstimateSeconds }
        : {}),
      ...(input.clearTestEstimate ? { clearTestEstimate: true } : {}),
      ...(input.workflowStatusId ? { workflowStatusId: input.workflowStatusId } : {}),
      ...(input.boardStageId ? { boardStageId: input.boardStageId } : {}),
      ...(input.clearBoardStageId ? { clearBoardStageId: true } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.clearPriority ? { clearPriority: true } : {}),
      ...(input.parentTodoId ? { parentTodoId: input.parentTodoId } : {}),
      ...(input.clearParentTodoId ? { clearParentTodoId: true } : {}),
      ...(input.fixVersionId ? { fixVersionId: input.fixVersionId } : {}),
      ...(input.clearFixVersionId ? { clearFixVersionId: true } : {}),
    };
    return projectTrackerEnvelope<{ updateOrganizationProjectTodo: Todo }>({
      organizationId: input.organizationId,
      query: `mutation UpdateOrganizationProjectTodo($input: UpdateOrganizationProjectTodoInput!) {
        updateOrganizationProjectTodo(input: $input) { ${TODO_FIELDS} }
      }`,
      variables: { input: variablesInput },
    })
      .then((r) => normalizeTodo(r.updateOrganizationProjectTodo))
      .catch(async (err) => {
        // Broad catch used to swallow permission/network failures and "succeed"
        // via a legacy mutation that dropped boardColumn — board DnD looked saved.
        if (!isAgileTodoSchemaMismatchError(err)) throw err;

        const legacyStatus: TodoStatus | undefined =
          input.status !== undefined
            ? input.status
            : input.boardColumn === "DONE"
              ? "DONE"
              : input.boardColumn !== undefined
                ? "OPEN"
                : undefined;

        const r = await projectTrackerEnvelope<{
          updateOrganizationProjectTodo: Todo;
        }>({
          organizationId: input.organizationId,
          query: `mutation UpdateOrganizationProjectTodoLegacy($input: UpdateOrganizationProjectTodoInput!) {
            updateOrganizationProjectTodo(input: $input) { ${TODO_FIELDS_LEGACY} }
          }`,
          variables: {
            input: {
              todoId: input.todoId,
              ...(input.title !== undefined ? { title: input.title } : {}),
              ...(legacyStatus !== undefined ? { status: legacyStatus } : {}),
              ...(input.dueAt !== undefined && input.dueAt !== null
                ? { dueAt: input.dueAt }
                : {}),
              ...(input.clearDueAt ? { clearDueAt: true } : {}),
              ...(input.assignedToUserId
                ? { assignedToUserId: input.assignedToUserId }
                : {}),
              ...(input.clearAssignedToUserId
                ? { clearAssignedToUserId: true }
                : {}),
            },
          },
        });
        const normalized = normalizeTodo(r.updateOrganizationProjectTodo);
        // Preserve requested column in the client model when the server cannot.
        if (input.boardColumn) {
          return { ...normalized, boardColumn: input.boardColumn };
        }
        return normalized;
      });
  },

  listOrganizationProjectSprints: (organizationId: string, projectId: string) =>
    projectTrackerEnvelope<{ organizationProjectSprints: Sprint[] }>({
      organizationId,
      query: `query OrganizationProjectSprints($projectId: String!) {
        organizationProjectSprints(projectId: $projectId) {
          id projectId name goal startsAt endsAt status retroNotes capacityPoints maxIssues committedPoints completedPoints issueCount completedIssueCount createdAt updatedAt
        }
      }`,
      variables: { projectId },
    }).then((r) => r.organizationProjectSprints.map(normalizeSprint)),

  createOrganizationProjectSprint: (input: {
    organizationId: string;
    projectId: string;
    name: string;
    goal?: string;
    startsAt?: string | null;
    endsAt?: string | null;
    status?: SprintStatus;
    capacityPoints?: number | null;
    maxIssues?: number | null;
  }) =>
    projectTrackerEnvelope<{ createOrganizationProjectSprint: Sprint }>({
      organizationId: input.organizationId,
      query: `mutation CreateOrganizationProjectSprint($input: CreateOrganizationProjectSprintInput!) {
        createOrganizationProjectSprint(input: $input) {
          id projectId name goal startsAt endsAt status retroNotes capacityPoints maxIssues committedPoints completedPoints issueCount completedIssueCount createdAt updatedAt
        }
      }`,
      variables: {
        input: {
          projectId: input.projectId,
          name: input.name,
          ...(input.goal ? { goal: input.goal } : {}),
          ...(input.startsAt ? { startsAt: input.startsAt } : {}),
          ...(input.endsAt ? { endsAt: input.endsAt } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.capacityPoints != null ? { capacityPoints: input.capacityPoints } : {}),
          ...(input.maxIssues != null ? { maxIssues: input.maxIssues } : {}),
        },
      },
    }).then((r) => normalizeSprint(r.createOrganizationProjectSprint)),

  updateOrganizationProjectSprint: (input: {
    organizationId: string;
    sprintId: string;
    name?: string;
    goal?: string;
    startsAt?: string | null;
    endsAt?: string | null;
    clearStartsAt?: boolean;
    clearEndsAt?: boolean;
    status?: SprintStatus;
    retroNotes?: string;
    capacityPoints?: number | null;
    clearCapacityPoints?: boolean;
    maxIssues?: number | null;
    clearMaxIssues?: boolean;
  }) =>
    projectTrackerEnvelope<{ updateOrganizationProjectSprint: Sprint }>({
      organizationId: input.organizationId,
      query: `mutation UpdateOrganizationProjectSprint($input: UpdateOrganizationProjectSprintInput!) {
        updateOrganizationProjectSprint(input: $input) {
          id projectId name goal startsAt endsAt status retroNotes capacityPoints maxIssues committedPoints completedPoints issueCount completedIssueCount createdAt updatedAt
        }
      }`,
      variables: {
        input: {
          sprintId: input.sprintId,
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.goal !== undefined ? { goal: input.goal } : {}),
          ...(input.startsAt ? { startsAt: input.startsAt } : {}),
          ...(input.endsAt ? { endsAt: input.endsAt } : {}),
          ...(input.clearStartsAt ? { clearStartsAt: true } : {}),
          ...(input.clearEndsAt ? { clearEndsAt: true } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.retroNotes !== undefined
            ? { retroNotes: input.retroNotes }
            : {}),
          ...(input.capacityPoints != null ? { capacityPoints: input.capacityPoints } : {}),
          ...(input.clearCapacityPoints ? { clearCapacityPoints: true } : {}),
          ...(input.maxIssues != null ? { maxIssues: input.maxIssues } : {}),
          ...(input.clearMaxIssues ? { clearMaxIssues: true } : {}),
        },
      },
    }).then((r) => normalizeSprint(r.updateOrganizationProjectSprint)),

  deleteOrganizationProjectSprint: (organizationId: string, sprintId: string) =>
    projectTrackerEnvelope<{ deleteOrganizationProjectSprint: boolean }>({
      organizationId,
      query: `mutation DeleteOrganizationProjectSprint($sprintId: String!) {
        deleteOrganizationProjectSprint(sprintId: $sprintId)
      }`,
      variables: { sprintId },
    }).then((r) => r.deleteOrganizationProjectSprint),

  listOrganizationProjectBoardStages: (
    organizationId: string,
    projectId: string,
  ) =>
    projectTrackerEnvelope<{ organizationProjectBoardStages: BoardStage[] }>({
      organizationId,
      query: `query OrganizationProjectBoardStages($projectId: String!) {
        organizationProjectBoardStages(projectId: $projectId) {
          id projectId columnKey label sortOrder active wipLimit mapsToBoardColumn isSystem createdAt updatedAt
        }
      }`,
      variables: { projectId },
    }).then((r) => r.organizationProjectBoardStages.map(normalizeBoardStage)),

  updateOrganizationProjectBoardStage: (input: {
    organizationId: string;
    stageId: string;
    label?: string;
    active?: boolean;
    sortOrder?: number;
    wipLimit?: number | null;
    clearWipLimit?: boolean;
  }) =>
    projectTrackerEnvelope<{ updateOrganizationProjectBoardStage: BoardStage }>(
      {
        organizationId: input.organizationId,
        query: `mutation UpdateOrganizationProjectBoardStage($input: UpdateOrganizationProjectBoardStageInput!) {
          updateOrganizationProjectBoardStage(input: $input) {
            id projectId columnKey label sortOrder active wipLimit mapsToBoardColumn isSystem createdAt updatedAt
          }
        }`,
        variables: {
          input: {
            stageId: input.stageId,
            ...(input.label !== undefined ? { label: input.label } : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
            ...(input.sortOrder !== undefined
              ? { sortOrder: input.sortOrder }
              : {}),
            ...(input.wipLimit != null ? { wipLimit: input.wipLimit } : {}),
            ...(input.clearWipLimit ? { clearWipLimit: true } : {}),
          },
        },
      },
    ).then((r) => normalizeBoardStage(r.updateOrganizationProjectBoardStage)),

  applyOrganizationProjectBoardProcessPack: (
    organizationId: string,
    projectId: string,
    pack: BoardProcessPack,
  ) =>
    projectTrackerEnvelope<{
      applyOrganizationProjectBoardProcessPack: BoardStage[];
    }>({
      organizationId,
      query: `mutation ApplyBoardProcessPack($projectId: String!, $pack: OrganizationProjectBoardProcessPack!) {
        applyOrganizationProjectBoardProcessPack(projectId: $projectId, pack: $pack) {
          id projectId columnKey label sortOrder active wipLimit mapsToBoardColumn isSystem createdAt updatedAt
        }
      }`,
      variables: { projectId, pack },
    }    ).then((r) =>
      r.applyOrganizationProjectBoardProcessPack.map(normalizeBoardStage),
    ),

  createOrganizationProjectBoardStage: (input: {
    organizationId: string;
    projectId: string;
    label: string;
    columnKey?: string;
    mapsToBoardColumn?: BoardColumn;
    sortOrder?: number;
    wipLimit?: number | null;
  }) =>
    projectTrackerEnvelope<{ createOrganizationProjectBoardStage: BoardStage }>({
      organizationId: input.organizationId,
      query: `mutation CreateOrganizationProjectBoardStage($input: CreateOrganizationProjectBoardStageInput!) {
        createOrganizationProjectBoardStage(input: $input) {
          id projectId columnKey label sortOrder active wipLimit mapsToBoardColumn isSystem createdAt updatedAt
        }
      }`,
      variables: {
        input: {
          projectId: input.projectId,
          label: input.label,
          ...(input.columnKey ? { columnKey: input.columnKey } : {}),
          ...(input.mapsToBoardColumn
            ? { mapsToBoardColumn: input.mapsToBoardColumn }
            : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.wipLimit != null ? { wipLimit: input.wipLimit } : {}),
        },
      },
    }).then((r) => normalizeBoardStage(r.createOrganizationProjectBoardStage)),

  deleteOrganizationProjectBoardStage: (
    organizationId: string,
    stageId: string,
  ) =>
    projectTrackerEnvelope<{ deleteOrganizationProjectBoardStage: boolean }>({
      organizationId,
      query: `mutation DeleteOrganizationProjectBoardStage($stageId: String!) {
        deleteOrganizationProjectBoardStage(stageId: $stageId)
      }`,
      variables: { stageId },
    }).then((r) => r.deleteOrganizationProjectBoardStage),

  listOrganizationProjectWorkflowStatuses: (
    organizationId: string,
    projectId: string,
  ) =>
    projectTrackerEnvelope<{
      organizationProjectWorkflowStatuses: WorkflowStatus[];
    }>({
      organizationId,
      query: `query OrganizationProjectWorkflowStatuses($projectId: String!) {
        organizationProjectWorkflowStatuses(projectId: $projectId) {
          id projectId key label category sortOrder color mapsToBoardColumn boardStageId active isSystem createdAt updatedAt
        }
      }`,
      variables: { projectId },
    }).then((r) => r.organizationProjectWorkflowStatuses),

  createOrganizationProjectWorkflowStatus: (input: {
    organizationId: string;
    projectId: string;
    label: string;
    key?: string;
    category?: WorkflowStatusCategory;
    sortOrder?: number;
    color?: string | null;
    mapsToBoardColumn?: BoardColumn;
    boardStageId?: string | null;
  }) =>
    projectTrackerEnvelope<{
      createOrganizationProjectWorkflowStatus: WorkflowStatus;
    }>({
      organizationId: input.organizationId,
      query: `mutation CreateOrganizationProjectWorkflowStatus($input: CreateOrganizationProjectWorkflowStatusInput!) {
        createOrganizationProjectWorkflowStatus(input: $input) {
          id projectId key label category sortOrder color mapsToBoardColumn boardStageId active isSystem createdAt updatedAt
        }
      }`,
      variables: {
        input: {
          projectId: input.projectId,
          label: input.label,
          ...(input.key ? { key: input.key } : {}),
          ...(input.category ? { category: input.category } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.color ? { color: input.color } : {}),
          ...(input.mapsToBoardColumn
            ? { mapsToBoardColumn: input.mapsToBoardColumn }
            : {}),
          ...(input.boardStageId ? { boardStageId: input.boardStageId } : {}),
        },
      },
    }).then((r) => r.createOrganizationProjectWorkflowStatus),

  updateOrganizationProjectWorkflowStatus: (input: {
    organizationId: string;
    statusId: string;
    label?: string;
    category?: WorkflowStatusCategory;
    sortOrder?: number;
    color?: string | null;
    clearColor?: boolean;
    mapsToBoardColumn?: BoardColumn;
    boardStageId?: string | null;
    clearBoardStageId?: boolean;
    active?: boolean;
  }) =>
    projectTrackerEnvelope<{
      updateOrganizationProjectWorkflowStatus: WorkflowStatus;
    }>({
      organizationId: input.organizationId,
      query: `mutation UpdateOrganizationProjectWorkflowStatus($input: UpdateOrganizationProjectWorkflowStatusInput!) {
        updateOrganizationProjectWorkflowStatus(input: $input) {
          id projectId key label category sortOrder color mapsToBoardColumn boardStageId active isSystem createdAt updatedAt
        }
      }`,
      variables: {
        input: {
          statusId: input.statusId,
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.category ? { category: input.category } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.color ? { color: input.color } : {}),
          ...(input.clearColor ? { clearColor: true } : {}),
          ...(input.mapsToBoardColumn
            ? { mapsToBoardColumn: input.mapsToBoardColumn }
            : {}),
          ...(input.boardStageId ? { boardStageId: input.boardStageId } : {}),
          ...(input.clearBoardStageId ? { clearBoardStageId: true } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      },
    }).then((r) => r.updateOrganizationProjectWorkflowStatus),

  archiveOrganizationProjectWorkflowStatus: (
    organizationId: string,
    statusId: string,
  ) =>
    projectTrackerEnvelope<{
      archiveOrganizationProjectWorkflowStatus: WorkflowStatus;
    }>({
      organizationId,
      query: `mutation ArchiveOrganizationProjectWorkflowStatus($statusId: String!) {
        archiveOrganizationProjectWorkflowStatus(statusId: $statusId) {
          id projectId key label category sortOrder color mapsToBoardColumn boardStageId active isSystem createdAt updatedAt
        }
      }`,
      variables: { statusId },
    }).then((r) => r.archiveOrganizationProjectWorkflowStatus),

  deleteOrganizationProjectWorkflowStatus: (
    organizationId: string,
    statusId: string,
  ) =>
    projectTrackerEnvelope<{ deleteOrganizationProjectWorkflowStatus: boolean }>(
      {
        organizationId,
        query: `mutation DeleteOrganizationProjectWorkflowStatus($statusId: String!) {
          deleteOrganizationProjectWorkflowStatus(statusId: $statusId)
        }`,
        variables: { statusId },
      },
    ).then((r) => r.deleteOrganizationProjectWorkflowStatus),

  startOrganizationProjectTodoTimer: (
    organizationId: string,
    todoId: string,
    kind?: TodoTimerKind,
  ) =>
    projectTrackerEnvelope<{ startOrganizationProjectTodoTimer: TodoTimeEntry }>(
      {
        organizationId,
        query: `mutation StartOrganizationProjectTodoTimer($todoId: String!, $kind: OrganizationProjectTodoTimerKind) {
          startOrganizationProjectTodoTimer(todoId: $todoId, kind: $kind) {
            id todoId userId kind startedAt endedAt durationSeconds createdAt
          }
        }`,
        variables: { todoId, ...(kind ? { kind } : {}) },
      },
    ).then((r) => r.startOrganizationProjectTodoTimer),

  stopOrganizationProjectTodoTimer: (organizationId: string, todoId: string) =>
    projectTrackerEnvelope<{ stopOrganizationProjectTodoTimer: TodoTimeEntry }>({
      organizationId,
      query: `mutation StopOrganizationProjectTodoTimer($todoId: String!) {
        stopOrganizationProjectTodoTimer(todoId: $todoId) {
          id todoId userId kind startedAt endedAt durationSeconds createdAt
        }
      }`,
      variables: { todoId },
    }).then((r) => r.stopOrganizationProjectTodoTimer),

  addOrganizationProjectTodoTimeEntry: (input: {
    organizationId: string;
    todoId: string;
    kind?: TodoTimerKind;
    startedAt: string;
    endedAt: string;
    durationSeconds?: number;
  }) =>
    projectTrackerEnvelope<{ addOrganizationProjectTodoTimeEntry: TodoTimeEntry }>(
      {
        organizationId: input.organizationId,
        query: `mutation AddOrganizationProjectTodoTimeEntry($input: AddOrganizationProjectTodoTimeEntryInput!) {
          addOrganizationProjectTodoTimeEntry(input: $input) {
            id todoId userId kind startedAt endedAt durationSeconds createdAt
          }
        }`,
        variables: {
          input: {
            todoId: input.todoId,
            startedAt: input.startedAt,
            endedAt: input.endedAt,
            ...(input.kind ? { kind: input.kind } : {}),
            ...(input.durationSeconds != null
              ? { durationSeconds: input.durationSeconds }
              : {}),
          },
        },
      },
    ).then((r) => r.addOrganizationProjectTodoTimeEntry),

  listOrganizationProjectTodoTimeEntries: (
    organizationId: string,
    todoId: string,
  ) =>
    projectTrackerEnvelope<{
      organizationProjectTodoTimeEntries: TodoTimeEntry[];
    }>({
      organizationId,
      query: `query OrganizationProjectTodoTimeEntries($todoId: String!) {
        organizationProjectTodoTimeEntries(todoId: $todoId) {
          id todoId userId kind startedAt endedAt durationSeconds createdAt
        }
      }`,
      variables: { todoId },
    }).then((r) => r.organizationProjectTodoTimeEntries),

  deleteOrganizationProjectTodo: (organizationId: string, todoId: string) =>
    projectTrackerEnvelope<{ deleteOrganizationProjectTodo: boolean }>({
      organizationId,
      query: `mutation DeleteOrganizationProjectTodo($todoId: String!) {
        deleteOrganizationProjectTodo(todoId: $todoId)
      }`,
      variables: { todoId },
    }).then((r) => r.deleteOrganizationProjectTodo),

  createSubtask: (
    organizationId: string,
    projectTodoId: string,
    title: string,
  ) =>
    projectTrackerEnvelope<{
      createOrganizationProjectTodoSubtask: TodoSubtask;
    }>({
      organizationId,
      query: `mutation CreateSubtask($input: CreateOrganizationProjectTodoSubtaskInput!) {
        createOrganizationProjectTodoSubtask(input: $input) {
          id projectTodoId title completed sortOrder createdAt updatedAt
        }
      }`,
      variables: { input: { projectTodoId, title } },
    }).then((r) => r.createOrganizationProjectTodoSubtask),

  updateSubtask: (
    organizationId: string,
    input: { id: string; title?: string; completed?: boolean },
  ) =>
    projectTrackerEnvelope<{
      updateOrganizationProjectTodoSubtask: TodoSubtask;
    }>({
      organizationId,
      query: `mutation UpdateSubtask($input: UpdateOrganizationProjectTodoSubtaskInput!) {
        updateOrganizationProjectTodoSubtask(input: $input) {
          id projectTodoId title completed sortOrder createdAt updatedAt
        }
      }`,
      variables: { input },
    }).then((r) => r.updateOrganizationProjectTodoSubtask),

  deleteSubtask: (organizationId: string, id: string) =>
    projectTrackerEnvelope<{
      deleteOrganizationProjectTodoSubtask: boolean;
    }>({
      organizationId,
      query: `mutation DeleteSubtask($id: String!) {
        deleteOrganizationProjectTodoSubtask(id: $id)
      }`,
      variables: { id },
    }).then((r) => r.deleteOrganizationProjectTodoSubtask),

  organizationProjectPurchases: (organizationId: string, projectId: string) =>
    projectTrackerEnvelope<{
      organizationProjectPurchases: Purchase[];
    }>({
      organizationId,
      query: `query OrganizationProjectPurchases($projectId: String!) {
        organizationProjectPurchases(projectId: $projectId) {
          id projectId productName taxRate productPurpose price quantity
          productLink status statusNote currency createdByUserId createdAt updatedAt
        }
      }`,
      variables: { projectId },
    }).then((r) => r.organizationProjectPurchases.map(normalizePurchase)),

  createOrganizationProjectPurchase: (input: {
    organizationId: string;
    projectId: string;
    productName: string;
    price: number;
    quantity?: number;
    taxRate?: number;
    productPurpose?: string;
    productLink?: string;
    currency?: string;
    status?: PurchaseStatus;
    statusNote?: string;
  }) => {
    const body: Record<string, unknown> = {
      projectId: input.projectId,
      productName: input.productName.trim(),
      price: input.price,
    };
    if (input.quantity != null) body.quantity = input.quantity;
    if (input.taxRate != null) body.taxRate = input.taxRate;
    if (input.productPurpose) body.productPurpose = input.productPurpose;
    if (input.productLink?.trim()) body.productLink = input.productLink.trim();
    if (input.currency?.trim())
      body.currency = input.currency.trim().toUpperCase();
    if (input.status) body.status = input.status;
    if (input.statusNote?.trim()) body.statusNote = input.statusNote.trim();
    return projectTrackerEnvelope<{
      createOrganizationProjectPurchase: Purchase;
    }>({
      organizationId: input.organizationId,
      query: `mutation CreatePurchase($input: CreateOrganizationProjectPurchaseInput!) {
        createOrganizationProjectPurchase(input: $input) {
          id projectId productName taxRate productPurpose price quantity
          productLink status statusNote currency createdByUserId createdAt updatedAt
        }
      }`,
      variables: { input: body },
    }).then((r) => normalizePurchase(r.createOrganizationProjectPurchase));
  },

  updateOrganizationProjectPurchase: (input: {
    organizationId: string;
    purchaseId: string;
    productName: string;
    taxRate: number;
    productPurpose: string;
    price: number;
    quantity: number;
    productLink: string | null;
    currency: string;
    status: PurchaseStatus;
    statusNote: string;
  }) => {
    const gqlInput: Record<string, unknown> = {
      purchaseId: input.purchaseId,
      productName: input.productName.trim(),
      taxRate: input.taxRate,
      productPurpose: input.productPurpose,
      price: input.price,
      quantity: input.quantity,
      currency: input.currency.trim().toUpperCase(),
      status: input.status,
      statusNote: input.statusNote,
    };
    const link = input.productLink?.trim() ?? "";
    if (!link) gqlInput.clearProductLink = true;
    else gqlInput.productLink = link;
    return projectTrackerEnvelope<{
      updateOrganizationProjectPurchase: Purchase;
    }>({
      organizationId: input.organizationId,
      query: `mutation UpdatePurchase($input: UpdateOrganizationProjectPurchaseInput!) {
        updateOrganizationProjectPurchase(input: $input) {
          id projectId productName taxRate productPurpose price quantity
          productLink status statusNote currency createdByUserId createdAt updatedAt
        }
      }`,
      variables: { input: gqlInput },
    }).then((r) => normalizePurchase(r.updateOrganizationProjectPurchase));
  },

  deleteOrganizationProjectPurchase: (
    organizationId: string,
    purchaseId: string,
  ) =>
    projectTrackerEnvelope<{ deleteOrganizationProjectPurchase: boolean }>({
      organizationId,
      query: `mutation DeletePurchase($purchaseId: String!) {
        deleteOrganizationProjectPurchase(purchaseId: $purchaseId)
      }`,
      variables: { purchaseId },
    }).then((r) => r.deleteOrganizationProjectPurchase),

  myTodos: async () => {
    const queries = [
      `query MyTodosWithSubtasks {
        myTodos {
          id userID title completed organizationID assignedToUserID dueAt
          createdAt updatedAt
          subtasks { id userTodoId title completed sortOrder createdAt updatedAt }
        }
      }`,
      `query MyTodosWithDue {
        myTodos {
          id userID title completed organizationID assignedToUserID dueAt
          createdAt updatedAt
        }
      }`,
      `query MyTodosBasic {
        myTodos {
          id userID title completed organizationID assignedToUserID
          createdAt updatedAt
        }
      }`,
    ];
    let lastError: unknown;
    for (let i = 0; i < queries.length; i++) {
      try {
        const r = await graphqlRequest<{ myTodos: PersonalTodo[] }>(queries[i]!);
        return r.myTodos.map(normalizePersonal);
      } catch (e) {
        lastError = e;
        const canFallback =
          i < queries.length - 1 &&
          (isPersonalTodoSchemaMismatchError(e) ||
            (e instanceof GraphQLError &&
              /cannot query field|unknown field|http 422/i.test(e.message)));
        if (!canFallback) throw e;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to load personal todos");
  },

  createPersonalTodo: async (input: {
    title: string;
    dueAt?: string | null;
    organizationID?: string | null;
  }) => {
    const base = {
      title: input.title,
      completed: false,
      ...(input.organizationID
        ? { organizationID: input.organizationID }
        : {}),
    };
    try {
      const r = await graphqlRequest<{ createTodo: PersonalTodo }>(
        `mutation CreateTodo($input: CreateTodoInput!) {
          createTodo(input: $input) {
            id userID title completed organizationID assignedToUserID dueAt
            createdAt updatedAt
          }
        }`,
        {
          input: {
            ...base,
            ...(input.dueAt ? { dueAt: input.dueAt } : {}),
          },
        },
      );
      return normalizePersonal(r.createTodo);
    } catch (e) {
      if (!isPersonalTodoSchemaMismatchError(e)) throw e;
      const r = await graphqlRequest<{ createTodo: PersonalTodo }>(
        `mutation CreateTodoBasic($input: CreateTodoInput!) {
          createTodo(input: $input) {
            id userID title completed organizationID assignedToUserID
            createdAt updatedAt
          }
        }`,
        { input: base },
      );
      return normalizePersonal(r.createTodo);
    }
  },

  updatePersonalTodo: async (input: {
    id: string;
    title?: string;
    completed?: boolean;
    dueAt?: string | null;
    clearDueAt?: boolean;
  }) => {
    try {
      const r = await graphqlRequest<{ updateTodo: PersonalTodo }>(
        `mutation UpdateTodo($input: UpdateTodoInput!) {
          updateTodo(input: $input) {
            id userID title completed organizationID assignedToUserID dueAt
            createdAt updatedAt
          }
        }`,
        { input },
      );
      return normalizePersonal(r.updateTodo);
    } catch (e) {
      if (!isPersonalTodoSchemaMismatchError(e)) throw e;
      const { dueAt: _d, clearDueAt: _c, ...rest } = input;
      const r = await graphqlRequest<{ updateTodo: PersonalTodo }>(
        `mutation UpdateTodoBasic($input: UpdateTodoInput!) {
          updateTodo(input: $input) {
            id userID title completed organizationID assignedToUserID
            createdAt updatedAt
          }
        }`,
        { input: rest },
      );
      return normalizePersonal(r.updateTodo);
    }
  },

  deletePersonalTodo: (id: string) =>
    graphqlRequest<{ deleteTodo: boolean }>(
      `mutation DeleteTodo($id: UUID!) {
        deleteTodo(id: $id)
      }`,
      { id },
    ).then((r) => r.deleteTodo),

  createPersonalSubtask: (userTodoId: string, title: string) =>
    graphqlRequest<{ createUserTodoSubtask: PersonalTodoSubtask }>(
      `mutation CreateUserTodoSubtask($input: CreateUserTodoSubtaskInput!) {
        createUserTodoSubtask(input: $input) {
          id userTodoId title completed sortOrder createdAt updatedAt
        }
      }`,
      { input: { userTodoId, title } },
    ).then((r) => r.createUserTodoSubtask),

  updatePersonalSubtask: (input: {
    id: string;
    title?: string;
    completed?: boolean;
  }) =>
    graphqlRequest<{ updateUserTodoSubtask: PersonalTodoSubtask }>(
      `mutation UpdateUserTodoSubtask($input: UpdateUserTodoSubtaskInput!) {
        updateUserTodoSubtask(input: $input) {
          id userTodoId title completed sortOrder createdAt updatedAt
        }
      }`,
      { input },
    ).then((r) => r.updateUserTodoSubtask),

  deletePersonalSubtask: (id: string) =>
    graphqlRequest<{ deleteUserTodoSubtask: boolean }>(
      `mutation DeleteUserTodoSubtask($id: UUID!) {
        deleteUserTodoSubtask(id: $id)
      }`,
      { id },
    ).then((r) => r.deleteUserTodoSubtask),

  /** Org chat — platform GraphQL (same as Expo / macOS). Not Particular. */
  organizationMessages: (organizationId: string, limit = 80) =>
    graphqlRequest<{ organizationMessages: OrganizationMessage[] }>(
      `query OrganizationMessages($organizationId: UUID!, $limit: Int) {
        organizationMessages(organizationId: $organizationId, limit: $limit) {
          id organizationID authorUserID authorNickname body createdAt
        }
      }`,
      { organizationId, limit },
    ).then((r) => r.organizationMessages),

  postOrganizationMessage: (organizationId: string, body: string) =>
    graphqlRequest<{ postOrganizationMessage: OrganizationMessage }>(
      `mutation PostOrganizationMessage($organizationId: UUID!, $body: String!) {
        postOrganizationMessage(organizationId: $organizationId, body: $body) {
          id organizationID authorUserID authorNickname body createdAt
        }
      }`,
      { organizationId, body },
    ).then((r) => r.postOrganizationMessage),

  deleteOrganizationMessage: (organizationId: string, messageId: string) =>
    graphqlRequest<{ deleteOrganizationMessage: boolean }>(
      `mutation DeleteOrganizationMessage($organizationId: UUID!, $messageId: UUID!) {
        deleteOrganizationMessage(organizationId: $organizationId, messageId: $messageId)
      }`,
      { organizationId, messageId },
    ).then((r) => r.deleteOrganizationMessage),

  listOrganizationProjectLabels: (organizationId: string, projectId: string) =>
    projectTrackerEnvelope<{ organizationProjectLabels: ProjectLabel[] }>({
      organizationId,
      query: `query OrganizationProjectLabels($projectId: String!) {
        organizationProjectLabels(projectId: $projectId) {
          id projectId name color createdAt updatedAt
        }
      }`,
      variables: { projectId },
    }).then((r) => r.organizationProjectLabels),

  createOrganizationProjectLabel: (input: {
    organizationId: string;
    projectId: string;
    name: string;
    color?: string | null;
  }) =>
    projectTrackerEnvelope<{ createOrganizationProjectLabel: ProjectLabel }>({
      organizationId: input.organizationId,
      query: `mutation CreateOrganizationProjectLabel($input: CreateOrganizationProjectLabelInput!) {
        createOrganizationProjectLabel(input: $input) {
          id projectId name color createdAt updatedAt
        }
      }`,
      variables: {
        input: {
          projectId: input.projectId,
          name: input.name,
          ...(input.color ? { color: input.color } : {}),
        },
      },
    }).then((r) => r.createOrganizationProjectLabel),

  updateOrganizationProjectLabel: (input: {
    organizationId: string;
    labelId: string;
    name?: string;
    color?: string | null;
    clearColor?: boolean;
  }) =>
    projectTrackerEnvelope<{ updateOrganizationProjectLabel: ProjectLabel }>({
      organizationId: input.organizationId,
      query: `mutation UpdateOrganizationProjectLabel($input: UpdateOrganizationProjectLabelInput!) {
        updateOrganizationProjectLabel(input: $input) {
          id projectId name color createdAt updatedAt
        }
      }`,
      variables: {
        input: {
          labelId: input.labelId,
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.color ? { color: input.color } : {}),
          ...(input.clearColor ? { clearColor: true } : {}),
        },
      },
    }).then((r) => r.updateOrganizationProjectLabel),

  deleteOrganizationProjectLabel: (organizationId: string, labelId: string) =>
    projectTrackerEnvelope<{ deleteOrganizationProjectLabel: boolean }>({
      organizationId,
      query: `mutation DeleteOrganizationProjectLabel($labelId: String!) {
        deleteOrganizationProjectLabel(labelId: $labelId)
      }`,
      variables: { labelId },
    }).then((r) => r.deleteOrganizationProjectLabel),

  addOrganizationProjectTodoLabel: (
    organizationId: string,
    todoId: string,
    labelId: string,
  ) =>
    projectTrackerEnvelope<{ addOrganizationProjectTodoLabel: Todo }>({
      organizationId,
      query: `mutation AddOrganizationProjectTodoLabel($todoId: String!, $labelId: String!) {
        addOrganizationProjectTodoLabel(todoId: $todoId, labelId: $labelId) { ${TODO_FIELDS} }
      }`,
      variables: { todoId, labelId },
    }).then((r) => normalizeTodo(r.addOrganizationProjectTodoLabel)),

  removeOrganizationProjectTodoLabel: (
    organizationId: string,
    todoId: string,
    labelId: string,
  ) =>
    projectTrackerEnvelope<{ removeOrganizationProjectTodoLabel: Todo }>({
      organizationId,
      query: `mutation RemoveOrganizationProjectTodoLabel($todoId: String!, $labelId: String!) {
        removeOrganizationProjectTodoLabel(todoId: $todoId, labelId: $labelId) { ${TODO_FIELDS} }
      }`,
      variables: { todoId, labelId },
    }).then((r) => normalizeTodo(r.removeOrganizationProjectTodoLabel)),

  listOrganizationProjectTodoComments: (organizationId: string, todoId: string) =>
    projectTrackerEnvelope<{ organizationProjectTodoComments: TodoComment[] }>({
      organizationId,
      query: `query OrganizationProjectTodoComments($todoId: String!) {
        organizationProjectTodoComments(todoId: $todoId) {
          id todoId authorUserId body createdAt updatedAt
        }
      }`,
      variables: { todoId },
    }).then((r) => r.organizationProjectTodoComments),

  createOrganizationProjectTodoComment: (
    organizationId: string,
    todoId: string,
    body: string,
  ) =>
    projectTrackerEnvelope<{ createOrganizationProjectTodoComment: TodoComment }>(
      {
        organizationId,
        query: `mutation CreateOrganizationProjectTodoComment($input: CreateOrganizationProjectTodoCommentInput!) {
          createOrganizationProjectTodoComment(input: $input) {
            id todoId authorUserId body createdAt updatedAt
          }
        }`,
        variables: { input: { todoId, body } },
      },
    ).then((r) => r.createOrganizationProjectTodoComment),

  updateOrganizationProjectTodoComment: (
    organizationId: string,
    commentId: string,
    body: string,
  ) =>
    projectTrackerEnvelope<{ updateOrganizationProjectTodoComment: TodoComment }>(
      {
        organizationId,
        query: `mutation UpdateOrganizationProjectTodoComment($input: UpdateOrganizationProjectTodoCommentInput!) {
          updateOrganizationProjectTodoComment(input: $input) {
            id todoId authorUserId body createdAt updatedAt
          }
        }`,
        variables: { input: { commentId, body } },
      },
    ).then((r) => r.updateOrganizationProjectTodoComment),

  deleteOrganizationProjectTodoComment: (
    organizationId: string,
    commentId: string,
  ) =>
    projectTrackerEnvelope<{ deleteOrganizationProjectTodoComment: boolean }>({
      organizationId,
      query: `mutation DeleteOrganizationProjectTodoComment($commentId: String!) {
        deleteOrganizationProjectTodoComment(commentId: $commentId)
      }`,
      variables: { commentId },
    }).then((r) => r.deleteOrganizationProjectTodoComment),

  listOrganizationProjectTodoLinks: (organizationId: string, todoId: string) =>
    projectTrackerEnvelope<{ organizationProjectTodoLinks: TodoLink[] }>({
      organizationId,
      query: `query OrganizationProjectTodoLinks($todoId: String!) {
        organizationProjectTodoLinks(todoId: $todoId) {
          id fromTodoId toTodoId kind createdAt
        }
      }`,
      variables: { todoId },
    }).then((r) => r.organizationProjectTodoLinks),

  createOrganizationProjectTodoLink: (input: {
    organizationId: string;
    fromTodoId: string;
    toTodoId: string;
    kind: TodoLinkKind;
  }) =>
    projectTrackerEnvelope<{ createOrganizationProjectTodoLink: TodoLink }>({
      organizationId: input.organizationId,
      query: `mutation CreateOrganizationProjectTodoLink($input: CreateOrganizationProjectTodoLinkInput!) {
        createOrganizationProjectTodoLink(input: $input) {
          id fromTodoId toTodoId kind createdAt
        }
      }`,
      variables: {
        input: {
          fromTodoId: input.fromTodoId,
          toTodoId: input.toTodoId,
          kind: input.kind,
        },
      },
    }).then((r) => r.createOrganizationProjectTodoLink),

  deleteOrganizationProjectTodoLink: (organizationId: string, linkId: string) =>
    projectTrackerEnvelope<{ deleteOrganizationProjectTodoLink: boolean }>({
      organizationId,
      query: `mutation DeleteOrganizationProjectTodoLink($linkId: String!) {
        deleteOrganizationProjectTodoLink(linkId: $linkId)
      }`,
      variables: { linkId },
    }).then((r) => r.deleteOrganizationProjectTodoLink),

  listOrganizationProjectTodoWatchers: (organizationId: string, todoId: string) =>
    projectTrackerEnvelope<{ organizationProjectTodoWatchers: TodoWatcher[] }>({
      organizationId,
      query: `query OrganizationProjectTodoWatchers($todoId: String!) {
        organizationProjectTodoWatchers(todoId: $todoId) {
          todoId userId addedAt
        }
      }`,
      variables: { todoId },
    }).then((r) => r.organizationProjectTodoWatchers),

  addOrganizationProjectTodoWatcher: (
    organizationId: string,
    todoId: string,
    userId: string,
  ) =>
    projectTrackerEnvelope<{ addOrganizationProjectTodoWatcher: Todo }>({
      organizationId,
      query: `mutation AddOrganizationProjectTodoWatcher($todoId: String!, $userId: String!) {
        addOrganizationProjectTodoWatcher(todoId: $todoId, userId: $userId) { ${TODO_FIELDS} }
      }`,
      variables: { todoId, userId },
    }).then((r) => normalizeTodo(r.addOrganizationProjectTodoWatcher)),

  removeOrganizationProjectTodoWatcher: (
    organizationId: string,
    todoId: string,
    userId: string,
  ) =>
    projectTrackerEnvelope<{ removeOrganizationProjectTodoWatcher: Todo }>({
      organizationId,
      query: `mutation RemoveOrganizationProjectTodoWatcher($todoId: String!, $userId: String!) {
        removeOrganizationProjectTodoWatcher(todoId: $todoId, userId: $userId) { ${TODO_FIELDS} }
      }`,
      variables: { todoId, userId },
    }).then((r) => normalizeTodo(r.removeOrganizationProjectTodoWatcher)),

  listOrganizationProjectTodoActivities: (
    organizationId: string,
    todoId: string,
  ) =>
    projectTrackerEnvelope<{ organizationProjectTodoActivities: TodoActivity[] }>(
      {
        organizationId,
        query: `query OrganizationProjectTodoActivities($todoId: String!) {
          organizationProjectTodoActivities(todoId: $todoId) {
            id todoId actorUserId kind fromValue toValue createdAt
          }
        }`,
        variables: { todoId },
      },
    ).then((r) => r.organizationProjectTodoActivities),

  listOrganizationProjectReleases: (organizationId: string, projectId: string) =>
    projectTrackerEnvelope<{ organizationProjectReleases: ProjectRelease[] }>({
      organizationId,
      query: `query OrganizationProjectReleases($projectId: String!) {
        organizationProjectReleases(projectId: $projectId) {
          id projectId name status releasedAt createdAt updatedAt
        }
      }`,
      variables: { projectId },
    }).then((r) => r.organizationProjectReleases),

  createOrganizationProjectRelease: (input: {
    organizationId: string;
    projectId: string;
    name: string;
    status?: ReleaseStatus;
    releasedAt?: string | null;
  }) =>
    projectTrackerEnvelope<{ createOrganizationProjectRelease: ProjectRelease }>({
      organizationId: input.organizationId,
      query: `mutation CreateOrganizationProjectRelease($input: CreateOrganizationProjectReleaseInput!) {
        createOrganizationProjectRelease(input: $input) {
          id projectId name status releasedAt createdAt updatedAt
        }
      }`,
      variables: {
        input: {
          projectId: input.projectId,
          name: input.name,
          ...(input.status ? { status: input.status } : {}),
          ...(input.releasedAt ? { releasedAt: input.releasedAt } : {}),
        },
      },
    }).then((r) => r.createOrganizationProjectRelease),

  updateOrganizationProjectRelease: (input: {
    organizationId: string;
    releaseId: string;
    name?: string;
    status?: ReleaseStatus;
    releasedAt?: string | null;
    clearReleasedAt?: boolean;
  }) =>
    projectTrackerEnvelope<{ updateOrganizationProjectRelease: ProjectRelease }>({
      organizationId: input.organizationId,
      query: `mutation UpdateOrganizationProjectRelease($input: UpdateOrganizationProjectReleaseInput!) {
        updateOrganizationProjectRelease(input: $input) {
          id projectId name status releasedAt createdAt updatedAt
        }
      }`,
      variables: {
        input: {
          releaseId: input.releaseId,
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.releasedAt ? { releasedAt: input.releasedAt } : {}),
          ...(input.clearReleasedAt ? { clearReleasedAt: true } : {}),
        },
      },
    }).then((r) => r.updateOrganizationProjectRelease),

  deleteOrganizationProjectRelease: (organizationId: string, releaseId: string) =>
    projectTrackerEnvelope<{ deleteOrganizationProjectRelease: boolean }>({
      organizationId,
      query: `mutation DeleteOrganizationProjectRelease($releaseId: String!) {
        deleteOrganizationProjectRelease(releaseId: $releaseId)
      }`,
      variables: { releaseId },
    }).then((r) => r.deleteOrganizationProjectRelease),

  startOrganizationProjectSprint: (organizationId: string, sprintId: string) =>
    projectTrackerEnvelope<{ startOrganizationProjectSprint: Sprint }>({
      organizationId,
      query: `mutation StartOrganizationProjectSprint($sprintId: String!) {
        startOrganizationProjectSprint(sprintId: $sprintId) {
          id projectId name goal startsAt endsAt status retroNotes capacityPoints maxIssues committedPoints completedPoints issueCount completedIssueCount createdAt updatedAt
        }
      }`,
      variables: { sprintId },
    }).then((r) => normalizeSprint(r.startOrganizationProjectSprint)),

  completeOrganizationProjectSprint: (
    organizationId: string,
    sprintId: string,
    incompleteMove?: SprintIncompleteMove,
  ) =>
    projectTrackerEnvelope<{ completeOrganizationProjectSprint: Sprint }>({
      organizationId,
      query: `mutation CompleteOrganizationProjectSprint($sprintId: String!, $incompleteMove: OrganizationProjectSprintIncompleteMove) {
        completeOrganizationProjectSprint(sprintId: $sprintId, incompleteMove: $incompleteMove) {
          id projectId name goal startsAt endsAt status retroNotes capacityPoints maxIssues committedPoints completedPoints issueCount completedIssueCount createdAt updatedAt
        }
      }`,
      variables: { sprintId, ...(incompleteMove ? { incompleteMove } : {}) },
    }).then((r) => normalizeSprint(r.completeOrganizationProjectSprint)),

  listOrganizationProjectCustomFields: (organizationId: string, projectId: string) =>
    projectTrackerEnvelope<{ organizationProjectCustomFields: CustomField[] }>({
      organizationId,
      query: `query OrganizationProjectCustomFields($projectId: String!) {
        organizationProjectCustomFields(projectId: $projectId) {
          id projectId key label type options required sortOrder active createdAt updatedAt
        }
      }`,
      variables: { projectId },
    }).then((r) => r.organizationProjectCustomFields),

  createOrganizationProjectCustomField: (input: {
    organizationId: string;
    projectId: string;
    label: string;
    type: CustomFieldType;
    key?: string;
    options?: string[];
    required?: boolean;
  }) =>
    projectTrackerEnvelope<{ createOrganizationProjectCustomField: CustomField }>({
      organizationId: input.organizationId,
      query: `mutation CreateOrganizationProjectCustomField($input: CreateOrganizationProjectCustomFieldInput!) {
        createOrganizationProjectCustomField(input: $input) {
          id projectId key label type options required sortOrder active createdAt updatedAt
        }
      }`,
      variables: {
        input: {
          projectId: input.projectId,
          label: input.label,
          type: input.type,
          ...(input.key ? { key: input.key } : {}),
          ...(input.options ? { options: input.options } : {}),
          ...(input.required ? { required: true } : {}),
        },
      },
    }).then((r) => r.createOrganizationProjectCustomField),

  setOrganizationProjectTodoCustomFieldValue: (input: {
    organizationId: string;
    todoId: string;
    fieldId: string;
    valueJson?: string;
    clear?: boolean;
  }) =>
    projectTrackerEnvelope<{ setOrganizationProjectTodoCustomFieldValue: Todo }>({
      organizationId: input.organizationId,
      query: `mutation SetOrganizationProjectTodoCustomFieldValue($todoId: String!, $fieldId: String!, $valueJson: String, $clear: Boolean) {
        setOrganizationProjectTodoCustomFieldValue(todoId: $todoId, fieldId: $fieldId, valueJson: $valueJson, clear: $clear) { ${TODO_FIELDS} }
      }`,
      variables: {
        todoId: input.todoId,
        fieldId: input.fieldId,
        ...(input.valueJson !== undefined ? { valueJson: input.valueJson } : {}),
        ...(input.clear ? { clear: true } : {}),
      },
    }).then((r) => normalizeTodo(r.setOrganizationProjectTodoCustomFieldValue)),

  addOrganizationProjectTodoAttachment: (input: {
    organizationId: string;
    todoId: string;
    filename: string;
    url: string;
    contentType?: string;
    storageKey?: string;
    sizeBytes?: number;
  }) =>
    projectTrackerEnvelope<{ addOrganizationProjectTodoAttachment: TodoAttachment }>({
      organizationId: input.organizationId,
      query: `mutation AddOrganizationProjectTodoAttachment($input: AddOrganizationProjectTodoAttachmentInput!) {
        addOrganizationProjectTodoAttachment(input: $input) {
          id todoId uploadedByUserId filename contentType sizeBytes url storageKey createdAt
        }
      }`,
      variables: {
        input: {
          todoId: input.todoId,
          filename: input.filename,
          url: input.url,
          ...(input.contentType ? { contentType: input.contentType } : {}),
          ...(input.storageKey ? { storageKey: input.storageKey } : {}),
          ...(input.sizeBytes != null ? { sizeBytes: input.sizeBytes } : {}),
        },
      },
    }).then((r) => r.addOrganizationProjectTodoAttachment),

  deleteOrganizationProjectTodoAttachment: (organizationId: string, attachmentId: string) =>
    projectTrackerEnvelope<{ deleteOrganizationProjectTodoAttachment: boolean }>({
      organizationId,
      query: `mutation DeleteOrganizationProjectTodoAttachment($attachmentId: String!) {
        deleteOrganizationProjectTodoAttachment(attachmentId: $attachmentId)
      }`,
      variables: { attachmentId },
    }).then((r) => r.deleteOrganizationProjectTodoAttachment),

  listOrganizationProjectIssueTemplates: (organizationId: string, projectId: string) =>
    projectTrackerEnvelope<{ organizationProjectIssueTemplates: IssueTemplate[] }>({
      organizationId,
      query: `query OrganizationProjectIssueTemplates($projectId: String!) {
        organizationProjectIssueTemplates(projectId: $projectId) {
          id projectId name titleTemplate description defaultPriority defaultWorkflowStatusId defaultLabelIds sortOrder createdAt updatedAt
        }
      }`,
      variables: { projectId },
    }).then((r) => r.organizationProjectIssueTemplates),

  createOrganizationProjectTodoFromTemplate: (
    organizationId: string,
    templateId: string,
    title?: string,
  ) =>
    projectTrackerEnvelope<{ createOrganizationProjectTodoFromTemplate: Todo }>({
      organizationId,
      query: `mutation CreateOrganizationProjectTodoFromTemplate($templateId: String!, $title: String) {
        createOrganizationProjectTodoFromTemplate(templateId: $templateId, title: $title) { ${TODO_FIELDS} }
      }`,
      variables: { templateId, ...(title ? { title } : {}) },
    }).then((r) => normalizeTodo(r.createOrganizationProjectTodoFromTemplate)),

  listOrganizationProjectNotifications: (
    organizationId: string,
    unreadOnly?: boolean,
    limit?: number,
  ) =>
    projectTrackerEnvelope<{ organizationProjectNotifications: ProjectNotification[] }>({
      organizationId,
      query: `query OrganizationProjectNotifications($organizationId: String!, $unreadOnly: Boolean, $limit: Int) {
        organizationProjectNotifications(organizationId: $organizationId, unreadOnly: $unreadOnly, limit: $limit) {
          id organizationId projectId userId todoId kind title body readAt createdAt
        }
      }`,
      variables: { organizationId, unreadOnly, limit },
    }).then((r) => r.organizationProjectNotifications),

  markOrganizationProjectNotificationRead: (organizationId: string, notificationId: string) =>
    projectTrackerEnvelope<{ markOrganizationProjectNotificationRead: ProjectNotification }>({
      organizationId,
      query: `mutation MarkOrganizationProjectNotificationRead($notificationId: String!) {
        markOrganizationProjectNotificationRead(notificationId: $notificationId) {
          id organizationId projectId userId todoId kind title body readAt createdAt
        }
      }`,
      variables: { notificationId },
    }).then((r) => r.markOrganizationProjectNotificationRead),

  listOrganizationProjectComponents: (organizationId: string, projectId: string) =>
    projectTrackerEnvelope<{ organizationProjectComponents: ProjectComponent[] }>({
      organizationId,
      query: `query OrganizationProjectComponents($projectId: String!) {
        organizationProjectComponents(projectId: $projectId) {
          id projectId name description leadUserId createdAt updatedAt
        }
      }`,
      variables: { projectId },
    }).then((r) => r.organizationProjectComponents),

  upsertOrganizationProjectSlaPolicy: (organizationId: string, projectId: string, hours: number) =>
    projectTrackerEnvelope<{ upsertOrganizationProjectSlaPolicy: SlaPolicy }>({
      organizationId,
      query: `mutation UpsertOrganizationProjectSlaPolicy($projectId: String!, $hours: Int!) {
        upsertOrganizationProjectSlaPolicy(projectId: $projectId, hours: $hours) {
          projectId hours createdAt updatedAt
        }
      }`,
      variables: { projectId, hours },
    }).then((r) => r.upsertOrganizationProjectSlaPolicy),

  listOrganizationTeams: (organizationId: string) =>
    projectTrackerEnvelope<{ organizationTeams: OrgTeam[] }>({
      organizationId,
      query: `query OrganizationTeams($organizationId: String!) {
        organizationTeams(organizationId: $organizationId) {
          id organizationId name description parentTeamId leadUserId createdAt updatedAt
        }
      }`,
      variables: { organizationId },
    }).then((r) => r.organizationTeams),

  createOrganizationTeam: (input: {
    organizationId: string;
    name: string;
    description?: string;
    parentTeamId?: string;
    leadUserId?: string;
  }) =>
    projectTrackerEnvelope<{ createOrganizationTeam: OrgTeam }>({
      organizationId: input.organizationId,
      query: `mutation CreateOrganizationTeam($input: CreateOrganizationTeamInput!) {
        createOrganizationTeam(input: $input) {
          id organizationId name description parentTeamId leadUserId createdAt updatedAt
        }
      }`,
      variables: {
        input: {
          organizationId: input.organizationId,
          name: input.name,
          ...(input.description ? { description: input.description } : {}),
          ...(input.parentTeamId ? { parentTeamId: input.parentTeamId } : {}),
          ...(input.leadUserId ? { leadUserId: input.leadUserId } : {}),
        },
      },
    }).then((r) => r.createOrganizationTeam),

  addOrganizationTeamMember: (organizationId: string, teamId: string, userId: string) =>
    projectTrackerEnvelope<{ addOrganizationTeamMember: OrgTeamMember }>({
      organizationId,
      query: `mutation AddOrganizationTeamMember($teamId: String!, $userId: String!) {
        addOrganizationTeamMember(teamId: $teamId, userId: $userId) { teamId userId addedAt }
      }`,
      variables: { teamId, userId },
    }).then((r) => r.addOrganizationTeamMember),

  listOrganizationProjectReports: (organizationId: string, projectId?: string) =>
    projectTrackerEnvelope<{ organizationProjectReports: ProjectReport[] }>({
      organizationId,
      query: `query OrganizationProjectReports($organizationId: String!, $projectId: String) {
        organizationProjectReports(organizationId: $organizationId, projectId: $projectId) {
          id organizationId projectId name kind configJson createdByUserId createdAt updatedAt
        }
      }`,
      variables: { organizationId, projectId },
    }).then((r) => r.organizationProjectReports),

  runOrganizationProjectReport: (organizationId: string, reportId: string) =>
    projectTrackerEnvelope<{ runOrganizationProjectReport: ReportResult }>({
      organizationId,
      query: `query RunOrganizationProjectReport($reportId: String!) {
        runOrganizationProjectReport(reportId: $reportId) {
          kind generatedAt
          series { key label points issues seconds }
          totals { key label points issues seconds }
        }
      }`,
      variables: { reportId },
    }).then((r) => r.runOrganizationProjectReport),

  organizationProjectReportData: (input: {
    organizationId: string;
    projectId?: string;
    kind: ReportKind;
    configJson?: string;
  }) =>
    projectTrackerEnvelope<{ organizationProjectReportData: ReportResult }>({
      organizationId: input.organizationId,
      query: `query OrganizationProjectReportData($organizationId: String!, $projectId: String, $kind: OrganizationProjectReportKind!, $configJson: String) {
        organizationProjectReportData(organizationId: $organizationId, projectId: $projectId, kind: $kind, configJson: $configJson) {
          kind generatedAt
          series { key label points issues seconds }
          totals { key label points issues seconds }
        }
      }`,
      variables: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        kind: input.kind,
        configJson: input.configJson,
      },
    }).then((r) => r.organizationProjectReportData),

  organizationProjectPriorityStats: (organizationId: string, projectId: string) =>
    projectTrackerEnvelope<{ organizationProjectPriorityStats: PriorityStat[] }>({
      organizationId,
      query: `query OrganizationProjectPriorityStats($projectId: String!) {
        organizationProjectPriorityStats(projectId: $projectId) { priority issues points }
      }`,
      variables: { projectId },
    }).then((r) => r.organizationProjectPriorityStats),
};
