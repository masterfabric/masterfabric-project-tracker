import { graphqlRequest } from "mf-tracker-client";

export type GithubRepoRef = {
  owner: string;
  repo: string;
  slug: string;
};

export type GithubIssue = {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  htmlUrl: string;
  userLogin: string;
  labels: string[];
  comments: number;
  createdAt: string;
  updatedAt: string;
};

export type GithubPullRequest = {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  draft: boolean;
  mergedAt: string | null;
  htmlUrl: string;
  userLogin: string;
  reviewDecision: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppGithubIntegration = {
  isEnabled: boolean;
  clientId: string;
  redirectUrl: string;
  scopes: string[];
} | null;

/** Linked GitHub artifact on a MasterFabric task (local desktop prefs). */
export type TodoGithubLink = {
  id: string;
  kind: "pr" | "issue";
  owner: string;
  repo: string;
  number: number;
  htmlUrl: string;
  title: string;
  /** open | closed | merged | draft */
  status: string;
  linkedAt: string;
};

export type GithubLinkPrefs = {
  githubRepo?: string;
  githubToken?: string;
};

type GhIssueRaw = {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  user?: { login?: string } | null;
  labels?: Array<string | { name?: string }>;
  comments?: number;
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
};

type GhPullRaw = {
  id: number;
  number: number;
  title: string;
  state: string;
  draft?: boolean;
  merged_at?: string | null;
  html_url: string;
  user?: { login?: string } | null;
  created_at: string;
  updated_at: string;
};

const LS_REPO = "mf.desktop.githubRepo";
const LS_TOKEN = "mf.desktop.githubToken";
const LS_TODO_LINKS = "mf.desktop.todoGithubLinks";

function envRepoDefault(): string {
  return (import.meta.env.VITE_GITHUB_REPO ?? "").trim();
}

function envTokenDefault(): string {
  return (import.meta.env.VITE_GITHUB_TOKEN ?? "").trim();
}

/** Parse `owner/repo` or a github.com URL into a repo ref. */
export function parseGithubRepo(input: string): GithubRepoRef | null {
  const raw = input.trim();
  if (!raw) return null;

  let path = raw;
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      if (!u.hostname.replace(/^www\./, "").endsWith("github.com")) return null;
      path = u.pathname;
    }
  } catch {
    return null;
  }

  const cleaned = path
    .replace(/^\/+/, "")
    .replace(/\.git$/i, "")
    .replace(/\/$/, "");
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1];
  if (!owner || !repo || !/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    return null;
  }
  return { owner, repo, slug: `${owner}/${repo}` };
}

export function resolveGithubRepo(prefsRepo?: string | null): GithubRepoRef | null {
  return parseGithubRepo(prefsRepo?.trim() || envRepoDefault());
}

export function resolveGithubToken(prefsToken?: string | null): string {
  return (prefsToken?.trim() || envTokenDefault()).trim();
}

export async function readGithubLinkPrefs(): Promise<GithubLinkPrefs> {
  const api = typeof window !== "undefined" ? window.mfDesktop : undefined;
  if (api?.prefs?.get) {
    const prefs = await api.prefs.get();
    return {
      githubRepo: prefs.githubRepo,
      githubToken: prefs.githubToken,
    };
  }
  if (typeof localStorage === "undefined") return {};
  return {
    githubRepo: localStorage.getItem(LS_REPO) ?? undefined,
    githubToken: localStorage.getItem(LS_TOKEN) ?? undefined,
  };
}

export async function writeGithubLinkPrefs(next: {
  githubRepo?: string;
  githubToken?: string;
  clearToken?: boolean;
}): Promise<void> {
  const api = typeof window !== "undefined" ? window.mfDesktop : undefined;
  if (api?.prefs?.set) {
    const patch: { githubRepo?: string; githubToken?: string } = {};
    if (next.githubRepo !== undefined) patch.githubRepo = next.githubRepo;
    if (next.clearToken) patch.githubToken = "";
    else if (next.githubToken !== undefined) patch.githubToken = next.githubToken;
    await api.prefs.set(patch);
    return;
  }
  if (typeof localStorage === "undefined") return;
  if (next.githubRepo !== undefined) {
    if (next.githubRepo.trim()) localStorage.setItem(LS_REPO, next.githubRepo.trim());
    else localStorage.removeItem(LS_REPO);
  }
  if (next.clearToken) localStorage.removeItem(LS_TOKEN);
  else if (next.githubToken !== undefined && next.githubToken.trim()) {
    localStorage.setItem(LS_TOKEN, next.githubToken.trim());
  }
}

function todoLinkKey(orgId: string, projectId: string, todoId: string): string {
  return `${orgId}:${projectId}:${todoId}`;
}

type TodoLinkStore = Record<string, TodoGithubLink[]>;

function readTodoLinkStore(): TodoLinkStore {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_TODO_LINKS);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as TodoLinkStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeTodoLinkStore(store: TodoLinkStore): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LS_TODO_LINKS, JSON.stringify(store));
}

export function getTodoGithubLinks(
  orgId: string,
  projectId: string,
  todoId: string,
): TodoGithubLink[] {
  if (!orgId || !projectId || !todoId) return [];
  return readTodoLinkStore()[todoLinkKey(orgId, projectId, todoId)] ?? [];
}

export function setTodoGithubLinks(
  orgId: string,
  projectId: string,
  todoId: string,
  links: TodoGithubLink[],
): void {
  if (!orgId || !projectId || !todoId) return;
  const store = readTodoLinkStore();
  const key = todoLinkKey(orgId, projectId, todoId);
  if (links.length === 0) delete store[key];
  else store[key] = links;
  writeTodoLinkStore(store);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("mf-todo-github-links", {
        detail: { orgId, projectId, todoId },
      }),
    );
  }
}

export function upsertTodoGithubLink(
  orgId: string,
  projectId: string,
  todoId: string,
  link: TodoGithubLink,
): TodoGithubLink[] {
  const existing = getTodoGithubLinks(orgId, projectId, todoId);
  const withoutDup = existing.filter(
    (l) =>
      !(
        l.kind === link.kind &&
        l.owner === link.owner &&
        l.repo === link.repo &&
        l.number === link.number
      ),
  );
  const next = [link, ...withoutDup].slice(0, 8);
  setTodoGithubLinks(orgId, projectId, todoId, next);
  return next;
}

export function removeTodoGithubLink(
  orgId: string,
  projectId: string,
  todoId: string,
  linkId: string,
): TodoGithubLink[] {
  const next = getTodoGithubLinks(orgId, projectId, todoId).filter(
    (l) => l.id !== linkId,
  );
  setTodoGithubLinks(orgId, projectId, todoId, next);
  return next;
}

async function githubFetch<T>(path: string, token: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) detail = body.message;
    } catch {
      /* ignore */
    }
    if (res.status === 401) {
      throw new Error("GitHub auth failed — check the personal access token.");
    }
    if (res.status === 404) {
      throw new Error(
        "Not found (or private without a token that can read it).",
      );
    }
    if (res.status === 403) {
      throw new Error(`GitHub rate limit or permission denied: ${detail}`);
    }
    throw new Error(`GitHub API ${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}

export async function fetchGithubIssues(
  ref: GithubRepoRef,
  token: string,
): Promise<GithubIssue[]> {
  const raw = await githubFetch<GhIssueRaw[]>(
    `/repos/${ref.owner}/${ref.repo}/issues?state=all&per_page=40&sort=updated&direction=desc`,
    token,
  );
  return raw
    .filter((i) => !i.pull_request)
    .map((i) => ({
      id: i.id,
      number: i.number,
      title: i.title,
      state: i.state === "open" ? "open" : "closed",
      htmlUrl: i.html_url,
      userLogin: i.user?.login ?? "unknown",
      labels: (i.labels ?? [])
        .map((l) => (typeof l === "string" ? l : l.name ?? ""))
        .filter(Boolean),
      comments: i.comments ?? 0,
      createdAt: i.created_at,
      updatedAt: i.updated_at,
    }));
}

export async function fetchGithubPullRequests(
  ref: GithubRepoRef,
  token: string,
): Promise<GithubPullRequest[]> {
  const raw = await githubFetch<GhPullRaw[]>(
    `/repos/${ref.owner}/${ref.repo}/pulls?state=all&per_page=40&sort=updated&direction=desc`,
    token,
  );
  return raw.map((p) => ({
    id: p.id,
    number: p.number,
    title: p.title,
    state: p.state === "open" ? "open" : "closed",
    draft: Boolean(p.draft),
    mergedAt: p.merged_at ?? null,
    htmlUrl: p.html_url,
    userLogin: p.user?.login ?? "unknown",
    reviewDecision: null,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));
}

export async function fetchGithubPullRequest(
  owner: string,
  repo: string,
  number: number,
  token: string,
): Promise<GithubPullRequest> {
  const p = await githubFetch<GhPullRaw>(
    `/repos/${owner}/${repo}/pulls/${number}`,
    token,
  );
  return {
    id: p.id,
    number: p.number,
    title: p.title,
    state: p.state === "open" ? "open" : "closed",
    draft: Boolean(p.draft),
    mergedAt: p.merged_at ?? null,
    htmlUrl: p.html_url,
    userLogin: p.user?.login ?? "unknown",
    reviewDecision: null,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export async function fetchGithubIssue(
  owner: string,
  repo: string,
  number: number,
  token: string,
): Promise<GithubIssue & { isPullRequest: boolean }> {
  const i = await githubFetch<GhIssueRaw>(
    `/repos/${owner}/${repo}/issues/${number}`,
    token,
  );
  return {
    id: i.id,
    number: i.number,
    title: i.title,
    state: i.state === "open" ? "open" : "closed",
    htmlUrl: i.html_url,
    userLogin: i.user?.login ?? "unknown",
    labels: (i.labels ?? [])
      .map((l) => (typeof l === "string" ? l : l.name ?? ""))
      .filter(Boolean),
    comments: i.comments ?? 0,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
    isPullRequest: Boolean(i.pull_request),
  };
}

export type ParsedGithubArtifact = {
  kind: "pr" | "issue" | "number";
  owner?: string;
  repo?: string;
  number: number;
};

/** Parse a PR/issue URL, `owner/repo#n`, or `#n` / `n` against the linked repo. */
export function parseGithubArtifactInput(
  input: string,
): ParsedGithubArtifact | null {
  const raw = input.trim();
  if (!raw) return null;

  const hashOnly = raw.match(/^#?(\d+)$/);
  if (hashOnly) {
    return { kind: "number", number: Number(hashOnly[1]) };
  }

  const ownerHash = raw.match(/^([\w.-]+)\/([\w.-]+)#(\d+)$/);
  if (ownerHash) {
    return {
      kind: "number",
      owner: ownerHash[1],
      repo: ownerHash[2],
      number: Number(ownerHash[3]),
    };
  }

  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      if (!u.hostname.replace(/^www\./, "").endsWith("github.com")) return null;
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length < 4) return null;
      const [owner, repo, type, numStr] = parts;
      const number = Number(numStr);
      if (!owner || !repo || !Number.isFinite(number) || number < 1) return null;
      if (type === "pull" || type === "pulls") {
        return { kind: "pr", owner, repo, number };
      }
      if (type === "issues" || type === "issue") {
        return { kind: "issue", owner, repo, number };
      }
      return null;
    }
  } catch {
    return null;
  }

  return null;
}

export async function resolveAndFetchGithubLink(
  input: string,
  defaultRepo: GithubRepoRef | null,
  token: string,
): Promise<TodoGithubLink> {
  const parsed = parseGithubArtifactInput(input);
  if (!parsed) {
    throw new Error(
      "Paste a GitHub PR/issue URL, owner/repo#123, or #123 for the linked repo.",
    );
  }

  const owner = parsed.owner ?? defaultRepo?.owner;
  const repo = parsed.repo ?? defaultRepo?.repo;
  if (!owner || !repo) {
    throw new Error(
      "Link a default repository in Settings → GitHub, or paste a full github.com URL.",
    );
  }

  let kind: "pr" | "issue" = parsed.kind === "pr" ? "pr" : "issue";
  if (parsed.kind === "number") {
    const issue = await fetchGithubIssue(owner, repo, parsed.number, token);
    kind = issue.isPullRequest ? "pr" : "issue";
  }

  if (kind === "pr") {
    const pr = await fetchGithubPullRequest(owner, repo, parsed.number, token);
    return {
      id: `pr:${owner}/${repo}#${pr.number}`,
      kind: "pr",
      owner,
      repo,
      number: pr.number,
      htmlUrl: pr.htmlUrl,
      title: pr.title,
      status: prStatusLabel(pr),
      linkedAt: new Date().toISOString(),
    };
  }

  const issue = await fetchGithubIssue(owner, repo, parsed.number, token);
  if (issue.isPullRequest) {
    const pr = await fetchGithubPullRequest(owner, repo, parsed.number, token);
    return {
      id: `pr:${owner}/${repo}#${pr.number}`,
      kind: "pr",
      owner,
      repo,
      number: pr.number,
      htmlUrl: pr.htmlUrl,
      title: pr.title,
      status: prStatusLabel(pr),
      linkedAt: new Date().toISOString(),
    };
  }

  return {
    id: `issue:${owner}/${repo}#${issue.number}`,
    kind: "issue",
    owner,
    repo,
    number: issue.number,
    htmlUrl: issue.htmlUrl,
    title: issue.title,
    status: issue.state,
    linkedAt: new Date().toISOString(),
  };
}

export async function refreshTodoGithubLink(
  link: TodoGithubLink,
  token: string,
): Promise<TodoGithubLink> {
  if (link.kind === "pr") {
    const pr = await fetchGithubPullRequest(
      link.owner,
      link.repo,
      link.number,
      token,
    );
    return {
      ...link,
      title: pr.title,
      htmlUrl: pr.htmlUrl,
      status: prStatusLabel(pr),
    };
  }
  const issue = await fetchGithubIssue(
    link.owner,
    link.repo,
    link.number,
    token,
  );
  return {
    ...link,
    title: issue.title,
    htmlUrl: issue.htmlUrl,
    status: issue.state,
  };
}

/** MF app OAuth integration row (sign-in only today — not repo linking). */
export async function fetchAppGithubIntegration(): Promise<AppGithubIntegration> {
  try {
    const data = await graphqlRequest<{
      appIntegrations: Array<{
        integrationType: string;
        isEnabled: boolean;
        clientId: string;
        redirectUrl: string;
        scopes: string[];
      }>;
    }>(`query AppIntegrations {
      appIntegrations {
        integrationType
        isEnabled
        clientId
        redirectUrl
        scopes
      }
    }`);
    const row = data.appIntegrations.find(
      (i) => i.integrationType === "GITHUB" && i.isEnabled,
    );
    if (!row) return null;
    return {
      isEnabled: row.isEnabled,
      clientId: row.clientId,
      redirectUrl: row.redirectUrl,
      scopes: row.scopes ?? [],
    };
  } catch {
    return null;
  }
}

export function prStatusLabel(pr: GithubPullRequest): string {
  if (pr.mergedAt) return "merged";
  if (pr.state === "open" && pr.draft) return "draft";
  if (pr.state === "open") return "open";
  return "closed";
}

export function githubStatusBadgeClass(status: string): string {
  if (status === "open") {
    return "border-emerald-600/30 bg-emerald-500/10 text-emerald-800";
  }
  if (status === "merged") {
    return "border-slate-700/30 bg-slate-800/10 text-slate-800";
  }
  if (status === "draft") {
    return "border-amber-600/30 bg-amber-500/10 text-amber-900";
  }
  return "border-border bg-muted text-muted-foreground";
}

export function coreAppsIntegrationsUrl(): string {
  const base = (
    import.meta.env.VITE_MF_CORE_URL ?? "https://core.masterfabric.co"
  ).replace(/\/$/, "");
  return `${base}/apps`;
}

export function openGithubUrl(url: string): void {
  if (typeof window === "undefined") return;
  if (window.mfDesktop?.openExternal) {
    void window.mfDesktop.openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
