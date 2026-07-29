"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { CreateIssueDialog } from "@/components/create-issue-dialog";
import { IssueBoard } from "@/components/issue-board";
import { IssueDrawer } from "@/components/issue-drawer";
import { IssueList } from "@/components/issue-list";
import { ShortcutsHelp } from "@/components/shortcuts-help";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/cn";
import { useWorkspace } from "@/lib/workspace";

export function AppShell() {
  const {
    org,
    project,
    viewMode,
    setViewMode,
    statusFilter,
    setStatusFilter,
    query,
    setQuery,
    selectedTodoId,
    setSelectedTodoId,
    createTodo,
    refreshTodos,
    loading,
    error,
    filteredTodos,
  } = useWorkspace();

  const [createOpen, setCreateOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "Escape") {
        if (createOpen) {
          setCreateOpen(false);
          return;
        }
        if (helpOpen) {
          setHelpOpen(false);
          return;
        }
        if (selectedTodoId) {
          setSelectedTodoId(null);
          return;
        }
      }

      if (typing) return;

      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        if (project) setCreateOpen(true);
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "1") {
        setViewMode("list");
      } else if (e.key === "2") {
        setViewMode("board");
      } else if (e.key === "?") {
        setHelpOpen((v) => !v);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    createOpen,
    helpOpen,
    project,
    selectedTodoId,
    setSelectedTodoId,
    setViewMode,
  ]);

  return (
    <AuthGate>
      <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
        <Sidebar />

        <main className="relative flex min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5">
            <div className="min-w-0">
              <div className="mb-0.5 flex min-w-0 items-center gap-1 text-[11px] text-[var(--text-faint)]">
                <span className="truncate">{org?.name ?? "Organization"}</span>
                <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
                <span className="truncate text-[var(--text-muted)]">
                  {project?.name ?? "Project"}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <h1
                  className="truncate text-[17px] font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {project?.name ?? "Workspace"}
                </h1>
                {project ? (
                  <span className="font-mono text-[11px] tabular-nums text-[var(--text-faint)]">
                    {filteredTodos.length} shown
                  </span>
                ) : null}
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search issues"
                  className="w-44 rounded-lg border border-[var(--border)] bg-[var(--bg)] py-1.5 pl-8 pr-3 text-[13px] outline-none transition focus:border-[var(--accent)] sm:w-56"
                />
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-0.5">
                {(
                  [
                    ["all", "All"],
                    ["OPEN", "Open"],
                    ["DONE", "Done"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    data-active={statusFilter === value ? "true" : "false"}
                    onClick={() => setStatusFilter(value)}
                    className="mf-chip !h-7 !rounded-md border-transparent bg-transparent"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex rounded-lg border border-[var(--border)] bg-[var(--bg)] p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "rounded-md px-2 py-1.5 transition",
                    viewMode === "list"
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]",
                  )}
                  title="List (1)"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("board")}
                  className={cn(
                    "rounded-md px-2 py-1.5 transition",
                    viewMode === "board"
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]",
                  )}
                  title="Board (2)"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => void refreshTodos()}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                title="Refresh"
              >
                <RefreshCw
                  className={cn("h-4 w-4", loading && "animate-spin")}
                />
              </button>

              <button
                type="button"
                disabled={!project}
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                New issue
              </button>
            </div>
          </header>

          {error ? (
            <div className="border-b border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.08)] px-4 py-2 text-[13px] text-[var(--danger)]">
              {error}
            </div>
          ) : null}

          <div className="relative min-h-0 flex-1 bg-[var(--bg)]">
            {viewMode === "list" ? <IssueList /> : <IssueBoard />}
            <IssueDrawer />
          </div>
        </main>
      </div>

      <CreateIssueDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={async (title) => {
          await createTodo(title);
        }}
      />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </AuthGate>
  );
}
