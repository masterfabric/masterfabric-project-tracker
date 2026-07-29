"use client";

import { CircleDashed, FolderOpen } from "lucide-react";
import { IssueRow } from "./issue-row";
import { useWorkspace } from "@/lib/workspace";

export function IssueList() {
  const {
    filteredTodos,
    members,
    selectedTodoId,
    setSelectedTodoId,
    updateTodoStatus,
    project,
  } = useWorkspace();

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-faint)]">
          <FolderOpen className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[14px] font-medium">Pick a project</p>
          <p className="mt-1 max-w-xs text-[12px] text-[var(--text-faint)]">
            Select or create a project in the sidebar to open the issue list.
          </p>
        </div>
      </div>
    );
  }

  if (filteredTodos.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-faint)]">
          <CircleDashed className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[14px] font-medium">No issues match</p>
          <p className="mt-1 text-[12px] text-[var(--text-faint)]">
            Press <span className="mf-kbd">C</span> to create one, or clear
            filters.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mf-fade-up h-full overflow-y-auto mf-scroll">
      <div className="sticky top-0 z-10 grid grid-cols-[32px_minmax(0,1fr)_auto] gap-2 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)] backdrop-blur-md">
        <span />
        <span>Issue</span>
        <span className="pr-1 text-right">Properties</span>
      </div>
      {filteredTodos.map((todo, i) => (
        <div
          key={todo.id}
          className="mf-fade-up"
          style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}
        >
          <IssueRow
            todo={todo}
            members={members}
            active={selectedTodoId === todo.id}
            onOpen={() => setSelectedTodoId(todo.id)}
            onToggleStatus={() =>
              void updateTodoStatus(
                todo.id,
                todo.status === "DONE" ? "OPEN" : "DONE",
              )
            }
          />
        </div>
      ))}
    </div>
  );
}
