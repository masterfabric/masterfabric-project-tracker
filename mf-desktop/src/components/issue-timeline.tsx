"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WorkspaceSetup } from "@/components/workspace-setup";
import { cn } from "@/lib/utils";
import { formatDue, shortIssueId } from "@/lib/format";
import type { Todo } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";

function bucketKey(todo: Todo): string {
  if (!todo.dueAt) return "undated";
  const d = new Date(todo.dueAt);
  if (Number.isNaN(d.getTime())) return "undated";
  return d.toISOString().slice(0, 10);
}

function bucketLabel(key: string) {
  if (key === "undated") return "No deadline";
  const d = new Date(key + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diff = Math.round(
    (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  const base = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (diff === 0) return `Today · ${base}`;
  if (diff === 1) return `Tomorrow · ${base}`;
  if (diff === -1) return `Yesterday · ${base}`;
  if (diff < 0) return `Overdue · ${base}`;
  return base;
}

/**
 * Lightweight Timeline strip — issues ordered by due date.
 * Not a full Gantt; communicates process ordering by deadline.
 */
export function IssueTimeline() {
  const {
    filteredTodos,
    selectedTodoId,
    setSelectedTodoId,
    project,
    projects,
    org,
    requestCreateIssue,
  } = useWorkspace();

  const buckets = useMemo(() => {
    const map = new Map<string, Todo[]>();
    const sorted = [...filteredTodos].sort((a, b) => {
      if (!a.dueAt && !b.dueAt) return a.title.localeCompare(b.title);
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return a.dueAt.localeCompare(b.dueAt);
    });
    for (const t of sorted) {
      const k = bucketKey(t);
      const list = map.get(k) ?? [];
      list.push(t);
      map.set(k, list);
    }
    return Array.from(map.entries());
  }, [filteredTodos]);

  if (!org) {
    return <WorkspaceSetup mode="no-org" />;
  }

  if (projects.length === 0) {
    return <WorkspaceSetup mode="no-project" />;
  }

  if (!project) {
    return <WorkspaceSetup mode="select-project" />;
  }

  if (filteredTodos.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[14px] font-semibold">No issues yet</p>
        <p className="max-w-sm text-[13px] text-muted-foreground">
          Create an issue with a due date to see it on the timeline.
        </p>
        <Button
          type="button"
          size="sm"
          className="h-9 rounded-md"
          onClick={() => requestCreateIssue()}
        >
          <Plus data-icon="inline-start" />
          New issue
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-5 sm:px-6">
        <p className="text-[12px] text-muted-foreground">
          Timeline by deadline — process order without a Gantt engine. Undated
          issues sit at the end.
        </p>
        <ol className="relative flex flex-col gap-0 border-l border-border pl-5">
          {buckets.map(([key, items]) => (
            <li key={key} className="relative pb-6 last:pb-0">
              <span className="absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full border-2 border-foreground bg-card" />
              <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                {bucketLabel(key)}
              </p>
              <ul className="flex flex-col gap-1.5">
                {items.map((todo: Todo) => {
                  const overdue =
                    !!todo.dueAt &&
                    todo.status !== "DONE" &&
                    new Date(todo.dueAt).getTime() < Date.now();
                  return (
                    <li key={todo.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedTodoId(todo.id)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition hover:bg-muted/40",
                          selectedTodoId === todo.id &&
                            "border-foreground/30 bg-accent/50",
                        )}
                      >
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {shortIssueId(todo.id)}
                        </span>
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-[13px] font-medium",
                            todo.status === "DONE" &&
                              "text-muted-foreground line-through",
                          )}
                        >
                          {todo.title}
                        </span>
                        <Badge
                          variant="secondary"
                          className="rounded-md text-[10px]"
                        >
                          {todo.status === "DONE"
                            ? "Done"
                            : todo.assignedToUserId
                              ? "Doing"
                              : "To-do"}
                        </Badge>
                        <span
                          className={cn(
                            "shrink-0 text-[11px] tabular-nums",
                            overdue
                              ? "font-medium text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {formatDue(todo.dueAt) ?? "—"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </ScrollArea>
  );
}
