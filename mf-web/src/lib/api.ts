import { graphqlRequest } from "./graphql";
import type {
  AuthSession,
  AuthUser,
  LoginResult,
  Organization,
  Project,
  ProjectMember,
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
};
