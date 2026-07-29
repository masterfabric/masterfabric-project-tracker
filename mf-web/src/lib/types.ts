export type TodoStatus = "OPEN" | "DONE";

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
  createdByUserId: string;
  assignedToUserId: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  subtasks: TodoSubtask[];
}

export type ViewMode = "list" | "board";
export type StatusFilter = "all" | "OPEN" | "DONE";
