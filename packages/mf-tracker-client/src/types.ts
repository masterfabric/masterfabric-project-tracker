export type TodoStatus = "OPEN" | "DONE";
export type BoardColumn = "TODO" | "DOING" | "REVIEW" | "DONE";
/** Process pack toggles mid-flow stages (Review / Doing). */
export type BoardProcessPack = "DEFAULT" | "NO_REVIEW" | "SIMPLE";
export type TodoPriority = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type ProjectMemberRole = "LEAD" | "MEMBER";
export type SprintStatus = "PLANNED" | "ACTIVE" | "CLOSED";
export type PurchaseStatus = "REQUESTED" | "PURCHASED" | "CANCELLED";
export type WorkflowStatusCategory =
  | "BACKLOG"
  | "ACTIVE"
  | "TEST"
  | "DONE"
  | "CANCELLED";
export type TodoTimerKind = "DEV" | "TEST" | "REVIEW" | "OTHER";
export type TodoLinkKind = "BLOCKED_BY" | "BLOCKS" | "RELATED" | "DUPLICATE";
export type ReleaseStatus = "UNRELEASED" | "RELEASED" | "ARCHIVED";
export type TodoActivityKind = "STATUS_CHANGED" | "ASSIGNEE_CHANGED";
export type CustomFieldType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "SELECT"
  | "MULTISELECT"
  | "BOOL";
export type NotificationKind =
  | "ASSIGNED"
  | "COMMENTED"
  | "STATUS"
  | "WATCHING"
  | "DUE";
export type IssueSort = "RANK" | "PRIORITY" | "DUE" | "PRIORITY_THEN_RANK";
export type SprintIncompleteMove = "BACKLOG" | "NEXT";
export type ReportKind =
  | "VELOCITY"
  | "BURNDOWN"
  | "THROUGHPUT"
  | "TIME"
  | "PRIORITY"
  | "TEAM"
  | "CUSTOM";
/** Issues surface: Pipeline table · Board · Timeline */
export type ViewMode = "list" | "board" | "timeline";
export type StatusFilter = "all" | "OPEN" | "DONE" | "TRIAGE";
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
  teamId: string | null;
  issueSort: IssueSort;
  slaPolicy: SlaPolicy | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  userNickname: string;
  role: ProjectMemberRole;
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
  boardStageId: string | null;
  workflowStatusId: string | null;
  priority: TodoPriority;
  storyPoints: number | null;
  description: string;
  sprintId: string | null;
  rank: number;
  createdByUserId: string;
  reporterUserId: string | null;
  assignedToUserId: string | null;
  developerUserId: string | null;
  testerUserId: string | null;
  reviewerUserId: string | null;
  dueAt: string | null;
  estimateAt: string | null;
  testDueAt: string | null;
  testEstimateSeconds: number | null;
  timeSpentSeconds: number;
  testTimeSpentSeconds: number;
  devTimeSpentSeconds: number;
  parentTodoId: string | null;
  fixVersionId: string | null;
  teamId: string | null;
  effectiveTeamId: string | null;
  priorityRank: number;
  slaDueAt: string | null;
  slaBreached: boolean;
  createdAt: string;
  updatedAt: string;
  subtasks: TodoSubtask[];
  timeEntries: TodoTimeEntry[];
  labels: ProjectLabel[];
  comments: TodoComment[];
  links: TodoLink[];
  watchers: TodoWatcher[];
  attachments: TodoAttachment[];
  customFieldValues: CustomFieldValue[];
  components: ProjectComponent[];
}

export interface ProjectLabel {
  id: string;
  projectId: string;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TodoComment {
  id: string;
  todoId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface TodoLink {
  id: string;
  fromTodoId: string;
  toTodoId: string;
  kind: TodoLinkKind;
  createdAt: string;
}

export interface TodoWatcher {
  todoId: string;
  userId: string;
  addedAt: string;
}

export interface TodoActivity {
  id: string;
  todoId: string;
  actorUserId: string;
  kind: TodoActivityKind;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
}

export interface ProjectRelease {
  id: string;
  projectId: string;
  name: string;
  status: ReleaseStatus;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SlaPolicy {
  projectId: string;
  hours: number;
  createdAt: string;
  updatedAt: string;
}

export interface TodoAttachment {
  id: string;
  todoId: string;
  uploadedByUserId: string;
  filename: string;
  contentType: string | null;
  sizeBytes: number | null;
  url: string;
  storageKey: string | null;
  createdAt: string;
}

export interface CustomField {
  id: string;
  projectId: string;
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldValue {
  todoId: string;
  fieldId: string;
  valueJson: string;
  updatedAt: string;
}

export interface IssueTemplate {
  id: string;
  projectId: string;
  name: string;
  titleTemplate: string;
  description: string;
  defaultPriority: TodoPriority;
  defaultWorkflowStatusId: string | null;
  defaultLabelIds: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectNotification {
  id: string;
  organizationId: string;
  projectId: string;
  userId: string;
  todoId: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface ProjectComponent {
  id: string;
  projectId: string;
  name: string;
  description: string;
  leadUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrgTeam {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  parentTeamId: string | null;
  leadUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrgTeamMember {
  teamId: string;
  userId: string;
  addedAt: string;
}

export interface ProjectReport {
  id: string;
  organizationId: string;
  projectId: string | null;
  name: string;
  kind: ReportKind;
  configJson: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportBucket {
  key: string;
  label: string;
  points: number;
  issues: number;
  seconds: number;
}

export interface ReportResult {
  kind: ReportKind;
  generatedAt: string;
  series: ReportBucket[];
  totals: ReportBucket;
}

export interface PriorityStat {
  priority: TodoPriority;
  issues: number;
  points: number;
}

export interface TodoTimeEntry {
  id: string;
  todoId: string;
  userId: string;
  kind: TodoTimerKind;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  createdAt: string;
}

export interface WorkflowStatus {
  id: string;
  projectId: string;
  key: string;
  label: string;
  category: WorkflowStatusCategory;
  sortOrder: number;
  color: string | null;
  mapsToBoardColumn: BoardColumn;
  boardStageId: string | null;
  active: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
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
  capacityPoints: number | null;
  maxIssues: number | null;
  committedPoints: number;
  completedPoints: number;
  issueCount: number;
  completedIssueCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Project workflow column. `columnKey` is TODO/DOING/REVIEW/DONE or a custom slug. */
export interface BoardStage {
  id: string;
  projectId: string;
  columnKey: string;
  label: string;
  sortOrder: number;
  active: boolean;
  wipLimit: number | null;
  mapsToBoardColumn: BoardColumn;
  isSystem: boolean;
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
