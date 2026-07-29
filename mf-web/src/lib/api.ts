import { graphqlRequest, GraphQLError } from "./graphql";
import { isPersonalTodoSchemaMismatchError } from "./operator-errors";
import type {
  AuthSession,
  AuthUser,
  LoginResult,
  OrgInvitation,
  OrgMember,
  Organization,
  PersonalTodo,
  PersonalTodoSubtask,
  Project,
  ProjectMember,
  Purchase,
  PurchaseStatus,
  Todo,
  TodoStatus,
  TodoSubtask,
} from "./types";

const PARTICULAR_KEY =
  process.env.NEXT_PUBLIC_MF_PROJECT_TRACKER_PARTICULAR?.trim() ||
  "project_tracker";
const PROJECT_TRACKER_CAPABILITY = "project.tracker.graphql";

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
        particularKey: PARTICULAR_KEY,
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

function normalizeTodo(raw: Todo & { subtasks?: TodoSubtask[] | null }): Todo {
  return {
    ...raw,
    assignedToUserId: raw.assignedToUserId ?? null,
    dueAt: raw.dueAt ?? null,
    subtasks: raw.subtasks ?? [],
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
          id organizationID userID userNickname role membershipStatus joinedAt
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
          id organizationId name description createdByUserId createdAt updatedAt
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
          id projectId userId userNickname addedAt
        }
      }`,
      variables: { projectId },
    }).then((r) => r.organizationProjectMembers),

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
          organizationProjectTodos(projectId: $projectId) {
            id projectId title status createdByUserId assignedToUserId dueAt
            createdAt updatedAt
            subtasks { id projectTodoId title completed sortOrder createdAt updatedAt }
          }
        }`,
        variables: { projectId },
      });
      return r.organizationProjectTodos.map(normalizeTodo);
    } catch {
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
  },

  createOrganizationProjectTodo: (input: {
    organizationId: string;
    projectId: string;
    title: string;
    assignedToUserId?: string | null;
    dueAt?: string | null;
  }) =>
    projectTrackerEnvelope<{ createOrganizationProjectTodo: Todo }>({
      organizationId: input.organizationId,
      query: `mutation CreateOrganizationProjectTodo($input: CreateOrganizationProjectTodoInput!) {
        createOrganizationProjectTodo(input: $input) {
          id projectId title status createdByUserId assignedToUserId dueAt
          createdAt updatedAt
          subtasks { id projectTodoId title completed sortOrder createdAt updatedAt }
        }
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
    }).then((r) => normalizeTodo(r.createOrganizationProjectTodo)),

  updateOrganizationProjectTodo: (input: {
    organizationId: string;
    todoId: string;
    title?: string;
    status?: TodoStatus;
    dueAt?: string | null;
    clearDueAt?: boolean;
  }) =>
    projectTrackerEnvelope<{ updateOrganizationProjectTodo: Todo }>({
      organizationId: input.organizationId,
      query: `mutation UpdateOrganizationProjectTodo($input: UpdateOrganizationProjectTodoInput!) {
        updateOrganizationProjectTodo(input: $input) {
          id projectId title status createdByUserId assignedToUserId dueAt
          createdAt updatedAt
          subtasks { id projectTodoId title completed sortOrder createdAt updatedAt }
        }
      }`,
      variables: {
        input: {
          todoId: input.todoId,
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.dueAt !== undefined && input.dueAt !== null
            ? { dueAt: input.dueAt }
            : {}),
          ...(input.clearDueAt ? { clearDueAt: true } : {}),
        },
      },
    }).then((r) => normalizeTodo(r.updateOrganizationProjectTodo)),

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
};
