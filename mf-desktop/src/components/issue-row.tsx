"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Flag,
  GitPullRequest,
  ListTodo,
  Square,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatDue, initials, memberLabel, shortIssueId } from "@/lib/format";
import { getTodoGithubLinks, type TodoGithubLink } from "@/lib/github";
import { useWorkspace } from "@/lib/workspace";
import type { ProjectMember, Todo } from "@/lib/types";

export function urgencyOf(todo: Todo): "high" | "medium" | "low" | null {
  if (!todo.dueAt || todo.status === "DONE") return null;
  const ms = new Date(todo.dueAt).getTime() - Date.now();
  if (ms < 0) return "high";
  if (ms < 1000 * 60 * 60 * 24 * 3) return "medium";
  return "low";
}

export function stageLabel(todo: Todo): string {
  switch (todo.boardColumn) {
    case "DONE":
      return "Done";
    case "REVIEW":
      return "In Review";
    case "DOING":
      return "In Progress";
    case "TODO":
      return "To Do";
    default:
      return todo.status === "DONE" ? "Done" : "To Do";
  }
}

/**
 * Dense Jira-style issue row: key + bold title, status lozenge meta line,
 * due pill / avatar / priority only when present (no empty dashes).
 */
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
  const assigneeLabel = todo.assignedToUserId
    ? memberLabel(assignee?.userNickname)
    : null;
  const urg = urgencyOf(todo);
  const overdue =
    !!todo.dueAt &&
    todo.status !== "DONE" &&
    new Date(todo.dueAt).getTime() < Date.now();
  const stage = stageLabel(todo);
  const { orgId, projectId } = useWorkspace();
  const [ghLinks, setGhLinks] = useState<TodoGithubLink[]>([]);

  useEffect(() => {
    if (!orgId || !projectId) {
      setGhLinks([]);
      return;
    }
    const load = () =>
      setGhLinks(getTodoGithubLinks(orgId, projectId, todo.id));
    load();
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { todoId?: string }
        | undefined;
      if (!detail?.todoId || detail.todoId === todo.id) load();
    };
    window.addEventListener("mf-todo-github-links", onChange);
    return () => window.removeEventListener("mf-todo-github-links", onChange);
  }, [orgId, projectId, todo.id]);

  const primaryGh = ghLinks[0];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "mf-issue-row group grid cursor-pointer grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/50 px-3 py-1 transition-colors",
        "hover:bg-slate-50",
        active && "bg-slate-100/90 shadow-[inset_3px_0_0_0_#1E293B]",
      )}
    >
      <button
        type="button"
        aria-label={todo.status === "DONE" ? "Mark open" : "Mark done"}
        className="flex size-5 items-center justify-center text-muted-foreground hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          onToggleStatus();
        }}
      >
        {todo.status === "DONE" ? (
          <CheckCircle2 className="size-3.5 text-[var(--done)]" />
        ) : overdue ? (
          <AlertCircle className="size-3.5 text-[#1E293B]" />
        ) : (
          <Circle className="size-3.5 opacity-55 group-hover:opacity-100" />
        )}
      </button>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="inline-flex size-3.5 shrink-0 items-center justify-center text-[#1E293B]"
            title="Task"
          >
            <Square
              className={cn(
                "size-3",
                todo.status === "DONE"
                  ? "fill-[var(--done)] text-[var(--done)]"
                  : "fill-[#1E293B]/20 text-[#1E293B]",
              )}
              strokeWidth={1.75}
            />
          </span>
          <span className="shrink-0 font-mono text-[10.5px] font-semibold tracking-tight text-slate-500 tabular-nums">
            {shortIssueId(todo.id)}
          </span>
          <p
            className={cn(
              "min-w-0 truncate text-[13px] font-semibold leading-tight tracking-tight text-[#0F172A]",
              todo.status === "DONE" &&
                "font-medium text-muted-foreground line-through",
            )}
          >
            {todo.title}
          </p>
        </div>

        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 pl-[18px] text-[11px] leading-none text-muted-foreground">
          <span
            className={cn(
              "inline-flex h-[16px] shrink-0 items-center rounded-[3px] px-1.5 font-medium tracking-tight",
              todo.status === "DONE"
                ? "bg-slate-100 text-slate-500"
                : stage === "In Progress"
                  ? "bg-[#1E293B] text-white"
                  : "bg-slate-200/80 text-slate-700",
            )}
          >
            {stage}
          </span>
          <span className="truncate">{assigneeLabel ?? "Unassigned"}</span>
          {subCount > 0 ? (
            <>
              <span className="text-border">·</span>
              <span className="inline-flex shrink-0 items-center gap-0.5 font-mono tabular-nums">
                <ListTodo className="size-2.5" />
                {doneCount}/{subCount}
              </span>
            </>
          ) : null}
          {primaryGh ? (
            <>
              <span className="text-border">·</span>
              <span
                className="inline-flex shrink-0 items-center gap-0.5 font-mono tabular-nums"
                title={`${primaryGh.kind === "pr" ? "PR" : "Issue"} #${primaryGh.number} · ${primaryGh.status}`}
                data-testid="issue-row-github"
              >
                <GitPullRequest className="size-2.5" />
                #{primaryGh.number}
              </span>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {due ? (
          <span
            className={cn(
              "inline-flex h-[18px] items-center rounded-[3px] px-1.5 font-mono text-[10px] font-medium tabular-nums",
              overdue
                ? "bg-[#1E293B] text-white"
                : "bg-slate-100 text-slate-600",
            )}
          >
            {due}
          </span>
        ) : null}

        {assigneeLabel ? (
          <Avatar className="size-5 ring-1 ring-border" title={assigneeLabel}>
            <AvatarFallback className="bg-[#1E293B] text-[8px] font-semibold text-white">
              {initials(assigneeLabel)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span
            className="flex size-5 items-center justify-center rounded-full bg-slate-100 text-[8px] font-medium text-slate-400"
            title="Unassigned"
            aria-hidden
          />
        )}

        {urg ? (
          <span
            className="inline-flex size-5 items-center justify-center"
            title={
              urg === "high"
                ? "Overdue"
                : urg === "medium"
                  ? "Due soon"
                  : "Later"
            }
          >
            <Flag
              className={cn(
                "size-3",
                urg === "high" && "fill-[#1E293B] text-[#1E293B]",
                urg === "medium" && "fill-slate-400 text-slate-500",
                urg === "low" && "text-slate-400",
              )}
            />
          </span>
        ) : null}
      </div>
    </div>
  );
}
