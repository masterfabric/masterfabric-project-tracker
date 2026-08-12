"use client";

import { FormEvent, useState } from "react";
import {
  Check,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { formatDue } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace";

function PersonalDetail({
  onClose,
  className,
}: {
  onClose?: () => void;
  className?: string;
}) {
  const {
    selectedPersonal,
    deletePersonalTodo,
    addPersonalSubtask,
    togglePersonalSubtask,
    deletePersonalSubtask,
  } = useWorkspace();
  const [subTitle, setSubTitle] = useState("");

  async function onAddSub(e: FormEvent) {
    e.preventDefault();
    if (!selectedPersonal) return;
    const t = subTitle.trim();
    if (!t) return;
    await addPersonalSubtask(selectedPersonal.id, t);
    setSubTitle("");
  }

  if (!selectedPersonal) {
    return (
      <div className={`mf-empty h-full ${className ?? ""}`}>
        <p className="mf-empty-copy">Select a todo to edit subtasks</p>
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col p-5 ${className ?? ""}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="mf-panel-title min-w-0 leading-snug">
          {selectedPersonal.title}
        </h3>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this personal todo?")) {
                void deletePersonalTodo(selectedPersonal.id);
              }
            }}
            className="mf-btn mf-btn-ghost mf-btn-danger !p-2"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="mf-btn mf-btn-ghost !p-2"
              aria-label="Close detail"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
      <p className="mb-5 text-[13px] text-muted-foreground">
        Due{" "}
        {selectedPersonal.dueAt
          ? new Date(selectedPersonal.dueAt).toLocaleString()
          : "—"}
      </p>
      <h4 className="mf-section-title mb-2.5">Subtasks</h4>
      <ul className="mb-3 min-h-0 flex-1 space-y-0.5 overflow-y-auto mf-scroll">
        {selectedPersonal.subtasks.map((s) => (
          <li
            key={s.id}
            className="group flex items-center gap-2 rounded-[var(--radius)] px-2 py-2 hover:bg-muted/40"
          >
            <button
              type="button"
              onClick={() =>
                void togglePersonalSubtask(
                  selectedPersonal.id,
                  s.id,
                  !s.completed,
                )
              }
            >
              {s.completed ? (
                <Check className="h-4 w-4 text-[var(--done)]" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <span
              className={
                s.completed
                  ? "flex-1 text-[14px] text-muted-foreground line-through"
                  : "flex-1 text-[14px]"
              }
            >
              {s.title}
            </span>
            <button
              type="button"
              onClick={() =>
                void deletePersonalSubtask(selectedPersonal.id, s.id)
              }
              className="opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => void onAddSub(e)} className="mt-auto flex gap-2">
        <input
          value={subTitle}
          onChange={(e) => setSubTitle(e.target.value)}
          placeholder="Add subtask"
          className="mf-input flex-1"
        />
        <button type="submit" className="mf-btn !px-3">
          <Plus className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

export function PersonalTodosPanel() {
  const {
    filteredPersonal,
    createPersonalTodo,
    togglePersonalTodo,
    selectedPersonalId,
    setSelectedPersonalId,
    selectedPersonal,
  } = useWorkspace();

  const [title, setTitle] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [busy, setBusy] = useState(false);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    try {
      await createPersonalTodo(
        t,
        dueLocal ? new Date(dueLocal).toISOString() : null,
      );
      setTitle("");
      setDueLocal("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col border-r border-border/70 md:border-r">
        <div className="mf-panel-header">
          <h2 className="mf-panel-title">My Work</h2>
          <p className="mf-panel-sub">
            Personal tasks from mf-go — same list as mobile Home
          </p>
          <form
            onSubmit={(e) => void onCreate(e)}
            className="mt-3.5 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="New personal todo"
              className="mf-input min-w-0 flex-1 sm:min-w-[200px]"
            />
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={dueLocal}
                onChange={(e) => setDueLocal(e.target.value)}
                className="mf-input min-w-0 flex-1 sm:!w-auto"
              />
              <button
                type="submit"
                disabled={busy}
                className="mf-btn mf-btn-primary shrink-0"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
          </form>
        </div>

        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-3 mf-scroll">
          {filteredPersonal.length === 0 ? (
            <div className="mf-empty">
              <div className="mf-empty-icon">
                <Circle className="h-5 w-5" />
              </div>
              <div>
                <p className="mf-empty-title">No personal todos yet</p>
                <p className="mf-empty-copy mt-1.5">
                  Add one above — it syncs with the mobile home list.
                </p>
              </div>
            </div>
          ) : (
            filteredPersonal.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelectedPersonalId(t.id)}
                  className={`flex w-full items-center gap-2.5 rounded-[var(--radius)] px-3 py-2.5 text-left transition hover:bg-muted/40 ${
                    selectedPersonalId === t.id ? "bg-accent" : ""
                  }`}
                >
                  <span
                    role="presentation"
                    onClick={(e) => {
                      e.stopPropagation();
                      void togglePersonalTodo(t.id, !t.completed);
                    }}
                    className="text-muted-foreground"
                  >
                    {t.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-[var(--done)]" />
                    ) : (
                      <Circle className="h-4 w-4 text-[var(--open)]" />
                    )}
                  </span>
                  <span
                    className={
                      t.completed
                        ? "min-w-0 flex-1 truncate text-[14px] text-muted-foreground line-through"
                        : "min-w-0 flex-1 truncate text-[14px] font-medium"
                    }
                  >
                    {t.title}
                  </span>
                  {t.dueAt ? (
                    <span className="hidden shrink-0 text-[12px] text-muted-foreground sm:inline">
                      {formatDue(t.dueAt)}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <aside className="hidden w-[min(100%,380px)] shrink-0 flex-col bg-card/40 md:flex">
        <PersonalDetail />
      </aside>

      {selectedPersonal ? (
        <aside className="mf-slide-in absolute inset-y-0 right-0 z-30 flex w-full max-w-none flex-col border-l border-border/70 bg-card/40 shadow-lg md:hidden">
          <PersonalDetail onClose={() => setSelectedPersonalId(null)} />
        </aside>
      ) : null}
    </div>
  );
}
