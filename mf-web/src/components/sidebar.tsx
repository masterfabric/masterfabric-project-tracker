"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  Circle,
  LogOut,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";

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
    todos,
  } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const open = todos.filter((t) => t.status === "OPEN").length;
    const done = todos.filter((t) => t.status === "DONE").length;
    return { open, done, total: todos.length };
  }, [todos]);

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

  return (
    <aside className="flex h-full w-[var(--sidebar)] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-3.5 py-3.5">
        <Image
          src="/tracker-mark.png"
          alt="MasterFabric Tracker"
          width={32}
          height={32}
          className="h-8 w-8 rounded-lg ring-1 ring-[color-mix(in_oklab,var(--accent)_30%,transparent)]"
          priority
        />
        <div className="min-w-0">
          <p
            className="truncate text-[13px] font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Tracker
          </p>
          <p className="truncate text-[11px] text-[var(--text-faint)]">
            Desktop workspace
          </p>
        </div>
      </div>

      <div className="space-y-5 overflow-y-auto px-2.5 py-3.5 mf-scroll">
        <label className="block space-y-1.5 px-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Organization
          </span>
          <select
            value={orgId ?? ""}
            onChange={(e) => setOrgId(e.target.value || null)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-[13px] outline-none transition focus:border-[var(--accent)]"
          >
            {orgs.length === 0 ? (
              <option value="">No organizations</option>
            ) : (
              orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))
            )}
          </select>
        </label>

        <div>
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-faint)]">
              Projects
            </span>
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              className="rounded-md p-1 text-[var(--text-faint)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
              title="New project"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {creating ? (
            <div className="mb-2 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2">
              <input
                autoFocus
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onCreateProject();
                  if (e.key === "Escape") setCreating(false);
                }}
                placeholder="Project name"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void onCreateProject()}
                className="w-full rounded-md bg-[var(--accent)] px-2 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
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
                onClick={() => setProjectId(p.id)}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition",
                  projectId === p.id
                    ? "bg-[var(--accent-soft)] text-[var(--text)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    projectId === p.id
                      ? "bg-[var(--accent)]"
                      : "bg-[var(--text-faint)]",
                  )}
                />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
            {orgId && projects.length === 0 ? (
              <p className="px-2 py-3 text-[12px] leading-relaxed text-[var(--text-faint)]">
                No projects yet. Create one to start tracking issues on the
                desktop board.
              </p>
            ) : null}
          </div>
        </div>

        {projectId ? (
          <div className="mx-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-faint)]">
                Pulse
              </p>
              <span className="font-mono text-[10px] text-[var(--text-faint)]">
                {counts.total}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-[var(--bg-soft)] px-2.5 py-2">
                <div className="mb-1 flex items-center gap-1.5 text-[var(--open)]">
                  <Circle className="h-3 w-3" />
                  <span className="text-[10px] uppercase tracking-wide">
                    Open
                  </span>
                </div>
                <p className="text-lg font-semibold tracking-tight tabular-nums">
                  {counts.open}
                </p>
              </div>
              <div className="rounded-lg bg-[var(--bg-soft)] px-2.5 py-2">
                <div className="mb-1 flex items-center gap-1.5 text-[var(--done)]">
                  <CheckCircle2 className="h-3 w-3" />
                  <span className="text-[10px] uppercase tracking-wide">
                    Done
                  </span>
                </div>
                <p className="text-lg font-semibold tracking-tight tabular-nums">
                  {counts.done}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-auto border-t border-[var(--border)] p-2.5">
        <div className="mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5">
          <span className="mf-avatar">
            {initials(user?.displayName || user?.email || "?")}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium">
              {user?.displayName || "Account"}
            </p>
            <p className="truncate text-[10px] text-[var(--text-faint)]">
              {user?.email}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
        <p className="mt-1.5 flex flex-wrap items-center gap-1 px-2 text-[10px] text-[var(--text-faint)]">
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
