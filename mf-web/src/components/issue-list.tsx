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
      <div className="mf-empty h-full">
        <div className="mf-empty-icon">
          <FolderOpen className="h-5 w-5" />
        </div>
        <div>
          <p className="mf-empty-title">Pick a project</p>
          <p className="mf-empty-copy mt-1.5">
            Select or create a project in the sidebar to open the issue list.
          </p>
        </div>
      </div>
    );
  }

  if (filteredTodos.length === 0) {
    return (
      <div className="mf-empty h-full">
        <div className="mf-empty-icon">
          <CircleDashed className="h-5 w-5" />
        </div>
        <div>
          <p className="mf-empty-title">No issues match</p>
          <p className="mf-empty-copy mt-1.5">
            Press <span className="mf-kbd">C</span> to create one, or clear
            filters.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mf-fade-up h-full overflow-y-auto mf-scroll">
      <div className="sticky top-0 z-10 grid grid-cols-[40px_minmax(0,1fr)_auto] gap-2 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--bg)_90%,transparent)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-faint)] backdrop-blur-md">
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
