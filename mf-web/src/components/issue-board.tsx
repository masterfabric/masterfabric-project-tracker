"use client";

import { useState, type DragEvent } from "react";
import { CheckCircle2, Circle, FolderOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import { shortIssueId } from "@/lib/format";
import type { Todo, TodoStatus } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";

const COLUMNS: { status: TodoStatus; label: string; color: string }[] = [
  { status: "OPEN", label: "Open", color: "var(--open)" },
  { status: "DONE", label: "Done", color: "var(--done)" },
];

function BoardCard({
  todo,
  active,
  onOpen,
}: {
  todo: Todo;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/todo-id", todo.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      className={cn(
        "group w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-3.5 text-left shadow-[var(--shadow)] transition hover:-translate-y-px hover:border-[var(--border-strong)]",
        active && "border-[var(--accent)] bg-[var(--accent-soft)]",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] text-[var(--text-faint)]">
          {shortIssueId(todo.id)}
        </p>
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            todo.status === "DONE" ? "bg-[var(--done)]" : "bg-[var(--open)]",
          )}
        />
      </div>
      <p className="text-[14px] font-medium leading-snug tracking-tight">
        {todo.title}
      </p>
      {todo.subtasks.length > 0 ? (
        <p className="mt-2.5 text-[12px] text-[var(--text-faint)]">
          {todo.subtasks.filter((s) => s.completed).length}/
          {todo.subtasks.length} checklist
        </p>
      ) : null}
    </button>
  );
}

export function IssueBoard() {
  const {
    filteredTodos,
    selectedTodoId,
    setSelectedTodoId,
    updateTodoStatus,
    project,
  } = useWorkspace();
  const [over, setOver] = useState<TodoStatus | null>(null);

  if (!project) {
    return (
      <div className="mf-empty h-full">
        <div className="mf-empty-icon">
          <FolderOpen className="h-5 w-5" />
        </div>
        <p className="mf-empty-title">Pick a project for the board</p>
      </div>
    );
  }

  async function onDrop(status: TodoStatus, e: DragEvent) {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData("text/todo-id");
    if (!id) return;
    const todo = filteredTodos.find((t) => t.id === id);
    if (!todo || todo.status === status) return;
    await updateTodoStatus(id, status);
  }

  return (
    <div className="mf-fade-up grid h-full grid-cols-1 gap-4 overflow-auto p-5 md:grid-cols-2 mf-scroll">
      {COLUMNS.map((col) => {
        const items = filteredTodos.filter((t) => t.status === col.status);
        return (
          <section
            key={col.status}
            data-over={over === col.status ? "true" : "false"}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.status);
            }}
            onDragLeave={() => setOver((v) => (v === col.status ? null : v))}
            onDrop={(e) => void onDrop(col.status, e)}
            className="mf-board-col flex min-h-[320px] flex-col rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow)]"
          >
            <header className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
              {col.status === "OPEN" ? (
                <Circle className="h-3.5 w-3.5" style={{ color: col.color }} />
              ) : (
                <CheckCircle2
                  className="h-3.5 w-3.5"
                  style={{ color: col.color }}
                />
              )}
              <h2 className="text-[14px] font-semibold tracking-tight">
                {col.label}
              </h2>
              <span className="ml-auto rounded-lg bg-[var(--bg-soft)] px-2 py-0.5 font-mono text-[12px] tabular-nums text-[var(--text-muted)]">
                {items.length}
              </span>
            </header>
            <div className="flex flex-1 flex-col gap-2.5 p-3">
              {items.map((todo) => (
                <BoardCard
                  key={todo.id}
                  todo={todo}
                  active={selectedTodoId === todo.id}
                  onOpen={() => setSelectedTodoId(todo.id)}
                />
              ))}
              {items.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] px-3 py-10 text-center text-[13px] text-[var(--text-faint)]">
                  Drop issues here
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
