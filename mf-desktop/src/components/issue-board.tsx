"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  CheckCircle2,
  Flag,
  GitPullRequest,
  ListTodo,
  Plus,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WorkspaceSetup } from "@/components/workspace-setup";
import { IllusEmptyIssues } from "@/components/ops-illustrations";
import { urgencyOf } from "@/components/issue-row";
import { cn } from "@/lib/utils";
import {
  formatDue,
  initials,
  memberLabel,
  shortIssueId,
} from "@/lib/format";
import { getTodoGithubLinks, type TodoGithubLink } from "@/lib/github";
import type { ProjectMember, Todo } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";

type Stage = "todo" | "doing" | "review" | "done";

/** Honest Agile columns backed by `boardColumn` (Particular). */
const COLUMNS: {
  stage: Stage;
  label: string;
  accent: string;
}[] = [
  { stage: "todo", label: "Todo", accent: "bg-[#14B8A6]" },
  { stage: "doing", label: "In Progress", accent: "bg-[#2DD4BF]" },
  { stage: "review", label: "In Review", accent: "bg-[#5EEAD4]" },
  { stage: "done", label: "Done", accent: "bg-slate-500" },
];

export function stageOf(todo: Todo): Stage {
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
      // Prefer status only when boardColumn is missing (legacy payloads).
      return todo.status === "DONE" ? "done" : "todo";
  }
}

function BoardCardChrome({
  todo,
  members,
  active,
  dragging,
  style,
  setNodeRef,
  listeners,
  attributes,
  onOpen,
}: {
  todo: Todo;
  members: ProjectMember[];
  active: boolean;
  dragging?: boolean;
  style?: CSSProperties;
  setNodeRef?: (node: HTMLElement | null) => void;
  listeners?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  onOpen: () => void;
}) {
  const { orgId, projectId } = useWorkspace();
  const [ghLinks, setGhLinks] = useState<TodoGithubLink[]>([]);
  const assignee = members.find((m) => m.userId === todo.assignedToUserId);
  const label = todo.assignedToUserId
    ? memberLabel(assignee?.userNickname)
    : null;
  const due = formatDue(todo.dueAt);
  const urg = urgencyOf(todo);
  const overdue =
    !!todo.dueAt &&
    todo.status !== "DONE" &&
    new Date(todo.dueAt).getTime() < Date.now();
  const doneCount = todo.subtasks.filter((s) => s.completed).length;
  const subCount = todo.subtasks.length;
  const primaryGh = ghLinks[0];
  const stage = stageOf(todo);
  const accent =
    urg === "high"
      ? "bg-[#14B8A6]"
      : stage === "doing"
        ? "bg-[#2DD4BF]"
        : stage === "review"
          ? "bg-[#5EEAD4]"
          : stage === "done"
            ? "bg-slate-500"
            : "bg-[#14B8A6]/70";

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(attributes as object)}
      {...(listeners as object)}
      role="button"
      tabIndex={0}
      data-testid={`board-card-${todo.id}`}
      data-board-stage={stage}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "mf-kanban-card group relative w-full cursor-grab touch-none text-left",
        active && "mf-kanban-card-active",
        dragging && "mf-kanban-card-dragging",
      )}
    >
      <span className={cn("mf-kanban-card-accent", accent)} aria-hidden />
      <div className="mf-kanban-card-body">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] font-semibold tracking-tight text-slate-400 tabular-nums">
            {shortIssueId(todo.id)}
            {todo.storyPoints != null ? (
              <span className="ml-1.5 rounded-sm bg-slate-700 px-1 py-px text-[9px] text-slate-200">
                {todo.storyPoints}sp
              </span>
            ) : null}
          </span>
          {todo.status === "DONE" ? (
            <CheckCircle2 className="size-3.5 shrink-0 text-[#14B8A6]" aria-label="Done" />
          ) : urg ? (
            <Flag
              className={cn(
                "size-2.5 shrink-0",
                urg === "high" && "fill-[#14B8A6] text-[#14B8A6]",
                urg === "medium" && "fill-slate-400 text-slate-400",
                urg === "low" && "text-slate-500",
              )}
              aria-label={
                urg === "high"
                  ? "High priority"
                  : urg === "medium"
                    ? "Medium priority"
                    : "Low priority"
              }
            />
          ) : null}
        </div>
        <p
          className={cn(
            "mt-1.5 line-clamp-3 text-[13px] font-medium leading-snug tracking-tight text-slate-100",
            todo.status === "DONE" && "text-slate-400 line-through",
          )}
        >
          {todo.title}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {subCount > 0 ? (
            <span className="inline-flex items-center gap-0.5 rounded px-1 py-px font-mono text-[9.5px] tabular-nums text-slate-400 ring-1 ring-white/10">
              <ListTodo className="size-2.5" />
              {doneCount}/{subCount}
            </span>
          ) : null}
          {primaryGh ? (
            <span
              className="inline-flex items-center gap-0.5 rounded px-1 py-px font-mono text-[9.5px] tabular-nums text-slate-300 ring-1 ring-white/10"
              title={`${primaryGh.kind === "pr" ? "PR" : "Issue"} #${primaryGh.number} · ${primaryGh.status}`}
              data-testid="board-card-github"
            >
              <GitPullRequest className="size-2.5 text-[#14B8A6]" />
              #{primaryGh.number}
            </span>
          ) : null}
          <span className="flex-1" />
          {due ? (
            <span
              className={cn(
                "inline-flex h-4 items-center rounded px-1 font-mono text-[9.5px] font-medium tabular-nums",
                overdue
                  ? "bg-[#14B8A6] text-[#0F172A]"
                  : "bg-white/5 text-slate-400",
              )}
            >
              {due}
            </span>
          ) : null}
          {label ? (
            <Avatar className="size-5 ring-1 ring-white/15" title={label}>
              <AvatarFallback className="bg-[#14B8A6] text-[7.5px] font-semibold text-[#0F172A]">
                {initials(label)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <span
              className="flex size-5 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10"
              title="Unassigned"
              aria-hidden
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DraggableBoardCard({
  todo,
  members,
  active,
  onOpen,
}: {
  todo: Todo;
  members: ProjectMember[];
  active: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: todo.id,
      data: { type: "card", todoId: todo.id, stage: stageOf(todo) },
    });

  const style: CSSProperties | undefined = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <BoardCardChrome
      todo={todo}
      members={members}
      active={active}
      dragging={isDragging}
      style={style}
      setNodeRef={setNodeRef}
      listeners={listeners as unknown as Record<string, unknown>}
      attributes={attributes as unknown as Record<string, unknown>}
      onOpen={onOpen}
    />
  );
}

function BoardColumn({
  stage,
  label,
  accent,
  items,
  members,
  selectedTodoId,
  onOpen,
  onCreate,
}: {
  stage: Stage;
  label: string;
  accent: string;
  items: Todo[];
  members: ProjectMember[];
  selectedTodoId: string | null;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${stage}`,
    data: { type: "column", stage },
  });

  return (
    <section
      ref={setNodeRef}
      data-testid={`board-column-${stage}`}
      className={cn("mf-kanban-col", isOver && "mf-kanban-col-over")}
    >
      <header className="mf-kanban-col-head">
        <span className={cn("mf-kanban-col-dot", accent)} aria-hidden />
        <span className="mf-kanban-col-label">{label}</span>
        <span className="mf-kanban-col-count">{items.length}</span>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2.5 px-2.5 pb-3">
          {items.map((todo) => (
            <DraggableBoardCard
              key={todo.id}
              todo={todo}
              members={members}
              active={selectedTodoId === todo.id}
              onOpen={() => onOpen(todo.id)}
            />
          ))}
          {items.length === 0 ? (
            <div className="mf-kanban-drop-hint">Drop cards here</div>
          ) : null}
          {stage !== "done" ? (
            <button
              type="button"
              onClick={onCreate}
              className="mf-kanban-add"
              aria-label={`Create in ${label}`}
            >
              <Plus className="size-4 text-[#14B8A6]" />
            </button>
          ) : null}
        </div>
      </ScrollArea>
    </section>
  );
}

export function IssueBoard() {
  const {
    filteredTodos,
    members,
    selectedTodoId,
    setSelectedTodoId,
    moveTodoToBoardStage,
    project,
    projects,
    org,
    requestCreateIssue,
    statusFilter,
    query,
  } = useWorkspace();

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const byStage = useMemo(() => {
    const map: Record<Stage, Todo[]> = {
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

  const activeTodo = activeId
    ? filteredTodos.find((t) => t.id === activeId) ?? null
    : null;

  if (!org) {
    return <WorkspaceSetup mode="no-org" />;
  }

  if (projects.length === 0) {
    return <WorkspaceSetup mode="no-project" />;
  }

  if (!project) {
    return <WorkspaceSetup mode="select-project" />;
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    document.body.classList.add("mf-dragging");
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    document.body.classList.remove("mf-dragging");
    const todoId = String(e.active.id);
    const over = e.over;
    if (!over) return;

    let target: Stage | null = null;
    const overId = String(over.id);
    if (overId.startsWith("column:")) {
      target = overId.slice("column:".length) as Stage;
    } else {
      const overTodo = filteredTodos.find((t) => t.id === overId);
      if (overTodo) target = stageOf(overTodo);
      else if (over.data.current?.stage) {
        target = over.data.current.stage as Stage;
      }
    }
    if (!target) return;

    const todo = filteredTodos.find((t) => t.id === todoId);
    if (!todo) return;
    if (stageOf(todo) === target) return;
    await moveTodoToBoardStage(todoId, target);
  }

  if (filteredTodos.length === 0) {
    const filtered = statusFilter !== "all" || query.trim().length > 0;
    if (filtered) {
      return (
        <Empty className="h-full border-0">
          <EmptyHeader className="max-w-md gap-3">
            <EmptyMedia>
              <IllusEmptyIssues className="h-48 w-[min(100%,20rem)]" />
            </EmptyMedia>
            <EmptyTitle>No matching issues</EmptyTitle>
            <EmptyDescription>
              Clear filters or search to see more.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }
    // Empty project: still render columns so Create / drop targets stay usable.
  }

  return (
    <div className="mf-kanban" data-testid="issue-board">
      <div className="mf-kanban-toolbar">
        <div>
          <p className="mf-kanban-toolbar-title">Board</p>
          <p className="mf-kanban-toolbar-hint">
            Drag cards · Todo → In Progress → In Review → Done
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-7 shrink-0 gap-1 rounded-md bg-slate-800 px-2.5 text-[11px] font-semibold text-white hover:bg-slate-700"
          onClick={() => requestCreateIssue()}
        >
          <Plus className="size-3.5" />
          Create
        </Button>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={(e) => void onDragEnd(e)}
        onDragCancel={() => {
          setActiveId(null);
          document.body.classList.remove("mf-dragging");
        }}
      >
        <div className="mf-kanban-cols">
          {COLUMNS.map((col) => (
            <BoardColumn
              key={col.stage}
              stage={col.stage}
              label={col.label}
              accent={col.accent}
              items={byStage[col.stage]}
              members={members}
              selectedTodoId={selectedTodoId}
              onOpen={setSelectedTodoId}
              onCreate={() => requestCreateIssue()}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeTodo ? (
            <div className="mf-kanban-overlay w-[min(85vw,260px)] rotate-[1.5deg] scale-[1.03]">
              <BoardCardChrome
                todo={activeTodo}
                members={members}
                active
                onOpen={() => undefined}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
