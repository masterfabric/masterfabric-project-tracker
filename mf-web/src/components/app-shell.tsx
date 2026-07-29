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
import { PersonalTodosPanel } from "@/components/personal-todos-panel";
import { PurchasesPanel } from "@/components/purchases-panel";
import { ShortcutsHelp } from "@/components/shortcuts-help";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/cn";
import type { AssigneeFilter } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";

export function AppShell() {
  const { user } = useAuth();
  const {
    org,
    project,
    tab,
    viewMode,
    setViewMode,
    statusFilter,
    setStatusFilter,
    assigneeFilter,
    setAssigneeFilter,
    members,
    query,
    setQuery,
    selectedTodoId,
    setSelectedTodoId,
    setSelectedPersonalId,
    createTodo,
    refreshTodos,
    refreshPurchases,
    refreshPersonal,
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
          target.tagName === "SELECT" ||
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
        setSelectedPersonalId(null);
      }

      if (typing) return;

      if ((e.key === "c" || e.key === "C") && tab === "issues") {
        e.preventDefault();
        if (project) setCreateOpen(true);
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "1" && tab === "issues") {
        setViewMode("list");
      } else if (e.key === "2" && tab === "issues") {
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
    setSelectedPersonalId,
    setViewMode,
    tab,
  ]);

  function refresh() {
    if (tab === "purchases") void refreshPurchases();
    else if (tab === "personal") void refreshPersonal();
    else void refreshTodos();
  }

  const title =
    tab === "personal"
      ? "My todos"
      : tab === "purchases"
        ? "Purchases"
        : (project?.name ?? "Workspace");

  const subtitle =
    tab === "personal"
      ? "Personal tasks synced with mobile Home"
      : tab === "purchases"
        ? "Purchase lines for this project"
        : project
          ? `${filteredTodos.length} issue${filteredTodos.length === 1 ? "" : "s"} shown`
          : "Pick a project to get started";

  const assigneeOptions: { value: AssigneeFilter; label: string }[] = [
    { value: "all", label: "All assignees" },
    { value: "me", label: "Assigned to me" },
    { value: "unassigned", label: "Unassigned" },
    ...members.map((m) => ({
      value: `member:${m.userId}` as AssigneeFilter,
      label: m.userNickname || m.userId.slice(0, 8),
    })),
  ];

  return (
    <AuthGate>
      <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
        <Sidebar />

        <main className="relative flex min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)]/90 px-5 py-3.5 backdrop-blur-md">
            <div className="min-w-0">
              <div className="mb-0.5 flex min-w-0 items-center gap-1 text-[12px] text-[var(--text-faint)]">
                <span className="truncate">{org?.name ?? "Organization"}</span>
                <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
                <span className="truncate text-[var(--text-muted)]">
                  {tab === "personal"
                    ? user?.displayName || "Personal"
                    : (project?.name ?? "Project")}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <h1
                  className="truncate text-[20px] font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {title}
                </h1>
                <span className="text-[12.5px] text-[var(--text-faint)]">
                  {subtitle}
                </span>
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    tab === "purchases"
                      ? "Search purchases…"
                      : tab === "personal"
                        ? "Search todos…"
                        : "Search issues…"
                  }
                  className="mf-input w-48 !rounded-[var(--radius)] !py-2 pl-9 pr-3 sm:w-60"
                />
              </div>

              {tab !== "purchases" ? (
                <div className="flex items-center gap-0.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-soft)] p-1">
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
                      className="mf-chip !h-7 !rounded-lg border-transparent bg-transparent"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}

              {tab === "issues" ? (
                <select
                  value={assigneeFilter}
                  onChange={(e) =>
                    setAssigneeFilter(e.target.value as AssigneeFilter)
                  }
                  className="mf-input !w-auto !py-2 !text-[12.5px]"
                  title="Assignee filter"
                >
                  {assigneeOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : null}

              {tab === "issues" ? (
                <div className="flex rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-soft)] p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 transition",
                      viewMode === "list"
                        ? "bg-[var(--bg-elevated)] text-[var(--accent)] shadow-[var(--shadow)]"
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
                      "rounded-lg px-2.5 py-1.5 transition",
                      viewMode === "board"
                        ? "bg-[var(--bg-elevated)] text-[var(--accent)] shadow-[var(--shadow)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)]",
                    )}
                    title="Board (2)"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                onClick={refresh}
                className="mf-btn !px-2.5 !py-2"
                title="Refresh"
              >
                <RefreshCw
                  className={cn("h-4 w-4", loading && "animate-spin")}
                />
              </button>

              {tab === "issues" ? (
                <button
                  type="button"
                  disabled={!project}
                  onClick={() => setCreateOpen(true)}
                  className="mf-btn mf-btn-primary"
                >
                  <Plus className="h-4 w-4" />
                  New issue
                </button>
              ) : null}
            </div>
          </header>

          {error ? <div className="mf-banner-error">{error}</div> : null}

          <div className="relative min-h-0 flex-1">
            {tab === "purchases" ? (
              <PurchasesPanel />
            ) : tab === "personal" ? (
              <PersonalTodosPanel />
            ) : (
              <>
                {viewMode === "list" ? <IssueList /> : <IssueBoard />}
                <IssueDrawer />
              </>
            )}
          </div>
        </main>
      </div>

      <CreateIssueDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        members={members}
        onCreate={async (input) => {
          await createTodo(input);
        }}
      />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </AuthGate>
  );
}
