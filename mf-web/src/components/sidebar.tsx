"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  LogOut,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import type { WorkspaceTab } from "@/lib/types";

export function Sidebar() {
  const { user, logout } = useAuth();
  const {
    orgs,
    projects,
    orgId,
    projectId,
    setOrgId,
    setProjectId,
    createProject,
    createOrganization,
    deleteProject,
    renameProject,
    todos,
    members,
    orgMembers,
    addProjectMember,
    removeProjectMember,
    inviteToOrg,
    invitations,
    acceptInvite,
    declineInvite,
    tab,
    setTab,
  } = useWorkspace();

  const [creating, setCreating] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [memberToAdd, setMemberToAdd] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);

  const counts = useMemo(() => {
    const open = todos.filter((t) => t.status === "OPEN").length;
    const done = todos.filter((t) => t.status === "DONE").length;
    return { open, done, total: todos.length };
  }, [todos]);

  const projectMemberIds = useMemo(
    () => new Set(members.map((m) => m.userId)),
    [members],
  );

  const addableOrgMembers = useMemo(
    () =>
      orgMembers.filter(
        (m) =>
          m.membershipStatus === "ACTIVE" && !projectMemberIds.has(m.userID),
      ),
    [orgMembers, projectMemberIds],
  );

  async function onCreateProject() {
    const name = projectName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createProject(name);
      setProjectName("");
      setCreating(false);
    } finally {
      setBusy(false);
    }
  }

  async function onCreateOrg() {
    const name = orgName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createOrganization(name);
      setOrgName("");
      setCreatingOrg(false);
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: WorkspaceTab; label: string }[] = [
    { id: "issues", label: "Issues" },
    { id: "purchases", label: "Buys" },
    { id: "personal", label: "Mine" },
  ];

  const showProjectChrome = tab !== "personal";
  const showIssueExtras = projectId && tab === "issues";

  return (
    <aside className="flex h-full w-[var(--sidebar)] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <Image
          src="/tracker-mark.png"
          alt="MasterFabric Tracker"
          width={36}
          height={36}
          className="h-9 w-9 rounded-[10px] shadow-[var(--shadow)] ring-1 ring-[color-mix(in_oklab,var(--accent)_28%,transparent)]"
          priority
        />
        <div className="min-w-0">
          <p
            className="truncate text-[15px] font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Tracker
          </p>
          <p className="truncate text-[12px] text-[var(--text-faint)]">
            MasterFabric
          </p>
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="mf-tab-rail">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              data-active={tab === t.id ? "true" : "false"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-4 mf-scroll">
        {invitations.length > 0 ? (
          <section className="space-y-2 rounded-[var(--radius-lg)] border border-[color-mix(in_oklab,var(--accent)_28%,var(--border))] bg-[var(--accent-soft)] p-3">
            <p className="mf-section-title">Pending invites</p>
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 shadow-[var(--shadow)]"
              >
                <p className="truncate text-[13px] font-semibold">
                  {inv.organizationName || "Organization"}
                </p>
                <p className="truncate text-[11px] text-[var(--text-faint)]">
                  from {inv.inviterNickname || "someone"}
                </p>
                <div className="mt-2.5 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => void acceptInvite(inv.id)}
                    className="mf-btn mf-btn-primary flex-1 !py-1.5 !text-[12px]"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => void declineInvite(inv.id)}
                    className="mf-btn flex-1 !py-1.5 !text-[12px]"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        <section className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <p className="mf-section-title">Organization</p>
            <button
              type="button"
              onClick={() => setCreatingOrg((v) => !v)}
              className="mf-btn mf-btn-ghost !h-7 !w-7 !p-0"
              title="Create organization"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <select
            value={orgId ?? ""}
            onChange={(e) => setOrgId(e.target.value || null)}
            className="mf-input !py-2"
          >
            {orgs.length === 0 ? (
              <option value="">No organizations yet</option>
            ) : (
              orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))
            )}
          </select>
          {creatingOrg ? (
            <div className="space-y-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] p-2.5">
              <input
                autoFocus
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onCreateOrg();
                  if (e.key === "Escape") setCreatingOrg(false);
                }}
                placeholder="Organization name"
                className="mf-input !py-2 !text-[13px]"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void onCreateOrg()}
                className="mf-btn mf-btn-primary w-full !text-[12px]"
              >
                Create organization
              </button>
            </div>
          ) : null}
        </section>

        {showProjectChrome ? (
          <section className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <p className="mf-section-title">Projects</p>
              <button
                type="button"
                onClick={() => setCreating((v) => !v)}
                className="mf-btn mf-btn-ghost !h-7 !w-7 !p-0"
                title="New project"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {creating ? (
              <div className="space-y-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] p-2.5">
                <input
                  autoFocus
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void onCreateProject();
                    if (e.key === "Escape") setCreating(false);
                  }}
                  placeholder="Project name"
                  className="mf-input !py-2 !text-[13px]"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onCreateProject()}
                  className="mf-btn mf-btn-primary w-full !text-[12px]"
                >
                  Create project
                </button>
              </div>
            ) : null}

            <div className="space-y-0.5">
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  data-active={projectId === p.id ? "true" : "false"}
                  onClick={() => setProjectId(p.id)}
                  className="mf-nav-item"
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      projectId === p.id
                        ? "bg-[var(--accent)]"
                        : "bg-[var(--border-strong)]",
                    )}
                  />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
              {orgId && projects.length === 0 ? (
                <p className="px-2 py-3 text-[12.5px] leading-relaxed text-[var(--text-faint)]">
                  No projects yet. Create one to track issues and purchases.
                </p>
              ) : null}
              {!orgId ? (
                <p className="px-2 py-3 text-[12.5px] leading-relaxed text-[var(--text-faint)]">
                  Create or join an organization to see projects.
                </p>
              ) : null}
            </div>

            {projectId ? (
              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] p-2">
                {renaming ? (
                  <div className="flex gap-1.5">
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="mf-input !min-w-0 !flex-1 !py-1.5 !text-[12px]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const name = renameValue.trim();
                        if (!name) return;
                        void renameProject(name).then(() => setRenaming(false));
                      }}
                      className="mf-btn mf-btn-primary !px-2.5 !py-1.5 !text-[11px]"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const current = projects.find((p) => p.id === projectId);
                        setRenameValue(current?.name ?? "");
                        setRenaming(true);
                      }}
                      className="mf-btn flex-1 !py-1.5 !text-[11px]"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete this project?")) {
                          void deleteProject();
                        }
                      }}
                      className="mf-btn mf-btn-danger !px-2 !py-1.5"
                      title="Delete project"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </section>
        ) : null}

        {showProjectChrome && orgId ? (
          <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)]">
            <button
              type="button"
              onClick={() => setTeamOpen((v) => !v)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-[var(--bg-hover)]"
            >
              <Users className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span className="mf-section-title !normal-case !tracking-normal">
                Team & invites
              </span>
              <ChevronDown
                className={cn(
                  "ml-auto h-3.5 w-3.5 text-[var(--text-faint)] transition",
                  teamOpen && "rotate-180",
                )}
              />
            </button>

            {teamOpen ? (
              <div className="space-y-3 border-t border-[var(--border)] px-3 py-3">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-[var(--text-faint)]">
                    Invite to organization
                  </p>
                  <div className="flex gap-1.5">
                    <input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="email@company.com"
                      className="mf-input !min-w-0 !flex-1 !py-1.5 !text-[12px]"
                    />
                    <button
                      type="button"
                      title="Send invite"
                      onClick={() => {
                        const email = inviteEmail.trim();
                        if (!email) return;
                        void inviteToOrg(email).then(() => setInviteEmail(""));
                      }}
                      className="mf-btn !px-2.5"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {showIssueExtras ? (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-[var(--text-faint)]">
                      Project members
                    </p>
                    <ul className="space-y-0.5">
                      {members.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 text-[12.5px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                        >
                          <span className="truncate">
                            {m.userNickname || m.userId}
                          </span>
                          <button
                            type="button"
                            title="Remove"
                            onClick={() => void removeProjectMember(m.userId)}
                            className="text-[var(--text-faint)] hover:text-[var(--danger)]"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                      {members.length === 0 ? (
                        <p className="px-1.5 text-[11px] text-[var(--text-faint)]">
                          No roster members yet.
                        </p>
                      ) : null}
                    </ul>
                    {addableOrgMembers.length > 0 ? (
                      <div className="flex gap-1.5">
                        <select
                          value={memberToAdd}
                          onChange={(e) => setMemberToAdd(e.target.value)}
                          className="mf-input !min-w-0 !flex-1 !py-1.5 !text-[12px]"
                        >
                          <option value="">Add member…</option>
                          {addableOrgMembers.map((m) => (
                            <option key={m.userID} value={m.userID}>
                              {m.userNickname || m.userID.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!memberToAdd}
                          onClick={() => {
                            if (!memberToAdd) return;
                            void addProjectMember(memberToAdd).then(() =>
                              setMemberToAdd(""),
                            );
                          }}
                          className="mf-btn mf-btn-primary !px-2.5"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {showIssueExtras ? (
          <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="mf-section-title">Pulse</p>
              <span className="font-mono text-[11px] text-[var(--text-faint)]">
                {counts.total}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[var(--radius)] bg-[var(--bg-elevated)] px-2.5 py-2.5 shadow-[var(--shadow)]">
                <div className="mb-1 flex items-center gap-1.5 text-[var(--open)]">
                  <Circle className="h-3 w-3" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide">
                    Open
                  </span>
                </div>
                <p className="text-xl font-semibold tracking-tight tabular-nums">
                  {counts.open}
                </p>
              </div>
              <div className="rounded-[var(--radius)] bg-[var(--bg-elevated)] px-2.5 py-2.5 shadow-[var(--shadow)]">
                <div className="mb-1 flex items-center gap-1.5 text-[var(--done)]">
                  <CheckCircle2 className="h-3 w-3" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide">
                    Done
                  </span>
                </div>
                <p className="text-xl font-semibold tracking-tight tabular-nums">
                  {counts.done}
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <div className="mt-auto border-t border-[var(--border)] p-3">
        <div className="mb-1.5 flex items-center gap-2.5 rounded-[var(--radius)] px-2 py-2">
          <span className="mf-avatar !h-8 !w-8 !text-[0.7rem]">
            {initials(user?.displayName || user?.email || "?")}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">
              {user?.displayName || "Account"}
            </p>
            <p className="truncate text-[11px] text-[var(--text-faint)]">
              {user?.email}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="mf-btn mf-btn-ghost w-full !justify-start !px-2.5"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
        <p className="mt-2 flex flex-wrap items-center gap-1 px-2 text-[10px] text-[var(--text-faint)]">
          <span className="mf-kbd">C</span>
          <span>new</span>
          <span className="mx-0.5 opacity-40">·</span>
          <span className="mf-kbd">/</span>
          <span>find</span>
          <span className="mx-0.5 opacity-40">·</span>
          <span className="mf-kbd">?</span>
          <span>help</span>
        </p>
      </div>
    </aside>
  );
}
