"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WorkspaceSetup } from "@/components/workspace-setup";
import { IllusEmptyIssues } from "@/components/ops-illustrations";
import { IssueRow } from "@/components/issue-row";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { initials, memberLabel } from "@/lib/format";
import type { Todo } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";

type PipelineStage = "todo" | "doing" | "review" | "done";

const STAGES: {
  id: PipelineStage;
  label: string;
  pill: string;
  bar: string;
}[] = [
  {
    id: "todo",
    label: "Todo",
    pill: "bg-slate-200/90 text-slate-700",
    bar: "bg-slate-400",
  },
  {
    id: "doing",
    label: "In Progress",
    pill: "bg-[#1E293B] text-white",
    bar: "bg-[#1E293B]",
  },
  {
    id: "review",
    label: "In Review",
    pill: "bg-teal-100 text-teal-800",
    bar: "bg-teal-500",
  },
  {
    id: "done",
    label: "Done",
    pill: "bg-slate-100 text-slate-500",
    bar: "bg-slate-300",
  },
];

function stageOf(todo: Todo): PipelineStage {
  switch (todo.boardColumn) {
    case "DOING":
      return "doing";
    case "REVIEW":
      return "review";
    case "DONE":
      return "done";
    case "TODO":
      return "todo";
    default:
      return todo.status === "DONE" ? "done" : "todo";
  }
}

export function IssueList() {
  const {
    filteredTodos,
    members,
    selectedTodoId,
    setSelectedTodoId,
    updateTodoStatus,
    project,
    projects,
    org,
    requestCreateIssue,
    statusFilter,
    query,
  } = useWorkspace();

  const [collapsed, setCollapsed] = useState<Record<PipelineStage, boolean>>({
    todo: false,
    doing: false,
    review: false,
    done: false,
  });

  const grouped = useMemo(() => {
    const map: Record<PipelineStage, Todo[]> = {
      todo: [],
      doing: [],
      review: [],
      done: [],
    };
    for (const t of filteredTodos) {
      map[stageOf(t)].push(t);
    }
    return map;
  }, [filteredTodos]);

  const progress = useMemo(() => {
    if (filteredTodos.length === 0) return 0;
    const done = filteredTodos.filter((t) => t.status === "DONE").length;
    return Math.round((done / filteredTodos.length) * 100);
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
    const filtered = statusFilter !== "all" || query.trim().length > 0;
    return (
      <Empty className="h-full border-0">
        <EmptyHeader className="max-w-md gap-3">
          <EmptyMedia>
            <IllusEmptyIssues className="h-52 w-[min(100%,22rem)]" />
          </EmptyMedia>
          <EmptyTitle>
            {filtered ? "No matching issues" : "No issues yet"}
          </EmptyTitle>
          <EmptyDescription>
            {filtered
              ? "Clear filters or search to see more."
              : "Create the first issue to start the project pipeline."}
          </EmptyDescription>
        </EmptyHeader>
        {!filtered ? (
          <EmptyContent>
            <Button
              type="button"
              size="sm"
              onClick={() => requestCreateIssue()}
            >
              <Plus data-icon="inline-start" />
              New issue
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex h-8 shrink-0 items-center gap-3 border-b border-border bg-slate-50/80 px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="h-1.5 min-w-[7rem] flex-1 overflow-hidden rounded-sm bg-slate-200/80">
            <div
              className="h-full bg-[#1E293B] transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-slate-500">
            {progress}% · {filteredTodos.length}
          </span>
        </div>
        <div className="flex items-center">
          {members.slice(0, 5).map((m, i) => (
            <Avatar
              key={m.id}
              className={cn(
                "size-5 rounded-full ring-2 ring-white",
                i > 0 && "-ml-1.5",
              )}
              title={memberLabel(m.userNickname)}
            >
              <AvatarFallback className="bg-[#1E293B] text-[7.5px] font-semibold text-white">
                {initials(memberLabel(m.userNickname))}
              </AvatarFallback>
            </Avatar>
          ))}
          {members.length > 5 ? (
            <span className="-ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 font-mono text-[9px] font-medium ring-2 ring-white">
              +{members.length - 5}
            </span>
          ) : null}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {STAGES.map((stage) => {
          const items = grouped[stage.id];
          if (items.length === 0 && statusFilter !== "all") return null;
          const isCollapsed = collapsed[stage.id];
          return (
            <section key={stage.id} className="border-b border-border">
              <div className="sticky top-0 z-10 flex h-8 items-center gap-1 border-b border-border/60 bg-slate-100/95 px-1.5 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => ({
                      ...c,
                      [stage.id]: !c[stage.id],
                    }))
                  }
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded-sm px-1.5 py-1 text-left transition-colors hover:bg-white/70"
                >
                  <ChevronDown
                    className={cn(
                      "size-3.5 shrink-0 text-slate-500 transition",
                      isCollapsed && "-rotate-90",
                    )}
                  />
                  <span className={cn("h-3.5 w-1 shrink-0 rounded-[1px]", stage.bar)} />
                  <span
                    className={cn(
                      "inline-flex h-[18px] items-center rounded-[3px] px-1.5 text-[11px] font-semibold tracking-tight",
                      stage.pill,
                    )}
                  >
                    {stage.label}
                  </span>
                  <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[3px] bg-white px-1 font-mono text-[10.5px] font-semibold tabular-nums text-slate-600 ring-1 ring-border">
                    {items.length}
                  </span>
                </button>
                {stage.id !== "done" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 shrink-0 gap-0.5 px-1.5 text-[11px] text-slate-500 hover:bg-white hover:text-[#1E293B]"
                    onClick={() => requestCreateIssue()}
                  >
                    <Plus className="size-3.5" />
                    Create
                  </Button>
                ) : null}
              </div>

              {!isCollapsed
                ? items.map((todo) => (
                    <IssueRow
                      key={todo.id}
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
                  ))
                : null}

              {!isCollapsed && items.length === 0 ? (
                <div className="flex h-8 items-center justify-between gap-2 bg-white px-3">
                  <p className="text-[11.5px] text-slate-400">
                    No issues in this status
                  </p>
                  {stage.id !== "done" ? (
                    <button
                      type="button"
                      className="inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#1E293B]"
                      onClick={() => requestCreateIssue()}
                    >
                      <Plus className="size-3" />
                      Create issue
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </ScrollArea>
    </div>
  );
}
