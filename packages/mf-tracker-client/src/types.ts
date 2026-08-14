export type TodoStatus = "OPEN" | "DONE";
export type BoardColumn = "TODO" | "DOING" | "REVIEW" | "DONE";
export type SprintStatus = "PLANNED" | "ACTIVE" | "CLOSED";
export type PurchaseStatus = "REQUESTED" | "PURCHASED" | "CANCELLED";
/** Issues surface: Pipeline table · Board · Timeline */
export type ViewMode = "list" | "board" | "timeline";
export type StatusFilter = "all" | "OPEN" | "DONE";
/** all | me | unassigned | member:<userId> */
export type AssigneeFilter = "all" | "me" | "unassigned" | `member:${string}`;
export type WorkspaceTab =
  | "dashboard"
  | "backlog"
  | "board"
  | "sprints"
  | "reports"
  | "projects"
  | "issues"
  | "purchases"
  | "personal"
  | "team"
  | "chat"
  | "integrations"
  | "settings";

/** Org-wide chat message (mf-go `organizationMessages`). No per-channel API yet. */
export interface OrganizationMessage {
  id: string;
  organizationID: string;
  authorUserID: string;
  authorNickname: string;
  body: string;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarURL: string;
  role: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface LoginResult {
  otpRequired: boolean;
  loginToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user: AuthUser;
}

export interface Organization {
  id: string;
  name: string;
  description: string;
  logoURL: string;
}

export interface OrgMember {
  id: string;
  organizationID: string;
  userID: string;
  userNickname: string;
  userDisplayName: string;
  userEmail: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  membershipStatus: "ACTIVE" | "SUSPENDED";
  joinedAt: string;
}

export interface OrgInvitation {
  id: string;
  organizationID: string;
  inviterID: string;
  inviteeEmail: string;
  status: string;
  createdAt: string;
  organizationName?: string | null;
  inviterNickname?: string | null;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  userNickname: string;
  addedAt: string;
}

export interface TodoSubtask {
  id: string;
  projectTodoId: string;
  title: string;
  completed: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Todo {
  id: string;
  projectId: string;
  title: string;
  status: TodoStatus;
  boardColumn: BoardColumn;
  storyPoints: number | null;
  description: string;
  sprintId: string | null;
  rank: number;
  createdByUserId: string;
  assignedToUserId: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  subtasks: TodoSubtask[];
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string;
  startsAt: string | null;
  endsAt: string | null;
  status: SprintStatus;
  retroNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Purchase {
  id: string;
  projectId: string;
  productName: string;
  taxRate: number;
  productPurpose: string;
  price: number;
  quantity: number;
  productLink: string | null;
  status: PurchaseStatus;
  statusNote: string;
  currency: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalTodoSubtask {
  id: string;
  userTodoId: string;
  title: string;
  completed: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalTodo {
  id: string;
  userID: string;
  title: string;
  completed: boolean;
  organizationID: string | null;
  assignedToUserID: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  subtasks: PersonalTodoSubtask[];
}
