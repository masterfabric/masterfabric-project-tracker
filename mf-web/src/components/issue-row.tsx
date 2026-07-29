"use client";

import { CheckCircle2, Circle, CalendarDays, ListTodo } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDue, initials, shortIssueId } from "@/lib/format";
import type { ProjectMember, Todo } from "@/lib/types";

export function IssueRow({
  todo,
  members,
  active,
  onOpen,
  onToggleStatus,
}: {
  todo: Todo;
  members: ProjectMember[];
  active?: boolean;
  onOpen: () => void;
  onToggleStatus: () => void;
}) {
  const assignee = members.find((m) => m.userId === todo.assignedToUserId);
  const due = formatDue(todo.dueAt);
  const doneCount = todo.subtasks.filter((s) => s.completed).length;
  const subCount = todo.subtasks.length;

  return (
    <div
      role="button"
      tabIndex={0}
      data-active={active ? "true" : "false"}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="mf-row group grid cursor-pointer grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--border)] px-3 py-2"
    >
      <button
        type="button"
        aria-label={todo.status === "DONE" ? "Mark open" : "Mark done"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleStatus();
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition hover:bg-[var(--bg-soft)] hover:text-[var(--text)]"
      >
        {todo.status === "DONE" ? (
          <CheckCircle2 className="h-4 w-4 text-[var(--done)]" />
        ) : (
          <Circle className="h-4 w-4 text-[var(--open)] opacity-80 group-hover:opacity-100" />
        )}
      </button>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-mono text-[11px] text-[var(--text-faint)]">
            {shortIssueId(todo.id)}
          </span>
          <p
            className={cn(
              "truncate text-[13px] font-medium tracking-tight",
              todo.status === "DONE" && "text-[var(--text-muted)] line-through",
            )}
          >
            {todo.title}
          </p>
        </div>
        {subCount > 0 ? (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--text-faint)]">
            <ListTodo className="h-3 w-3" />
            {doneCount}/{subCount} checklist
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-faint)]">
        <span
          className={cn(
            "mf-chip !h-6",
            todo.status === "DONE"
              ? "!border-[color-mix(in_oklab,var(--done)_35%,transparent)] !text-[var(--done)]"
              : "!border-[color-mix(in_oklab,var(--open)_35%,transparent)] !text-[var(--open)]",
          )}
        >
          {todo.status === "DONE" ? "Done" : "Open"}
        </span>
        {due ? (
          <span className="mf-chip !h-6">
            <CalendarDays className="h-3 w-3" />
            {due}
          </span>
        ) : null}
        {assignee ? (
          <span className="mf-chip !h-6 !pl-1">
            <span className="mf-avatar !h-4 !w-4 !text-[0.5rem]">
              {initials(assignee.userNickname)}
            </span>
            {assignee.userNickname}
          </span>
        ) : (
          <span className="mf-chip !h-6 opacity-0 transition group-hover:opacity-100">
            Unassigned
          </span>
        )}
      </div>
    </div>
  );
}
