"use client";

import { FormEvent, useState } from "react";
import {
  Check,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
} from "lucide-react";
import { formatDue } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace";

export function PersonalTodosPanel() {
  const {
    filteredPersonal,
    createPersonalTodo,
    togglePersonalTodo,
    deletePersonalTodo,
    addPersonalSubtask,
    togglePersonalSubtask,
    deletePersonalSubtask,
    selectedPersonalId,
    setSelectedPersonalId,
    selectedPersonal,
  } = useWorkspace();

  const [title, setTitle] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [subTitle, setSubTitle] = useState("");
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

  async function onAddSub(e: FormEvent) {
    e.preventDefault();
    if (!selectedPersonal) return;
    const t = subTitle.trim();
    if (!t) return;
    await addPersonalSubtask(selectedPersonal.id, t);
    setSubTitle("");
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col border-r border-[var(--border)]">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h2
            className="text-[15px] font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            My todos
          </h2>
          <p className="text-[12px] text-[var(--text-faint)]">
            Personal tasks from mf-go — same list as mobile Home
          </p>
          <form
            onSubmit={(e) => void onCreate(e)}
            className="mt-3 flex flex-wrap gap-2"
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="New personal todo"
              className="min-w-[200px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
            />
            <input
              type="datetime-local"
              value={dueLocal}
              onChange={(e) => setDueLocal(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-[13px] font-medium text-white disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </form>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto p-2 mf-scroll">
          {filteredPersonal.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-[var(--text-faint)]">
              No personal todos yet.
            </p>
          ) : (
            filteredPersonal.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelectedPersonalId(t.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-[var(--bg-hover)] ${
                    selectedPersonalId === t.id
                      ? "bg-[var(--accent-soft)]"
                      : ""
                  }`}
                >
                  <span
                    role="presentation"
                    onClick={(e) => {
                      e.stopPropagation();
                      void togglePersonalTodo(t.id, !t.completed);
                    }}
                    className="text-[var(--text-muted)]"
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
                        ? "min-w-0 flex-1 truncate text-[13px] text-[var(--text-muted)] line-through"
                        : "min-w-0 flex-1 truncate text-[13px]"
                    }
                  >
                    {t.title}
                  </span>
                  {t.dueAt ? (
                    <span className="shrink-0 text-[11px] text-[var(--text-faint)]">
                      {formatDue(t.dueAt)}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <aside className="hidden w-[360px] shrink-0 flex-col bg-[var(--bg-elevated)] md:flex">
        {selectedPersonal ? (
          <div className="flex h-full flex-col p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <h3
                className="text-[16px] font-semibold leading-snug"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {selectedPersonal.title}
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (confirm("Delete this personal todo?")) {
                    void deletePersonalTodo(selectedPersonal.id);
                  }
                }}
                className="rounded-md p-1.5 text-[var(--text-faint)] hover:bg-[rgba(248,113,113,0.12)] hover:text-[var(--danger)]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-[12px] text-[var(--text-faint)]">
              Due{" "}
              {selectedPersonal.dueAt
                ? new Date(selectedPersonal.dueAt).toLocaleString()
                : "—"}
            </p>
            <h4 className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-faint)]">
              Subtasks
            </h4>
            <p className="mb-2 text-[11px] text-[var(--text-faint)]">
              Requires mf-go with user-todo subtasks; older servers ignore this
              section on save errors.
            </p>
            <ul className="mb-3 space-y-1">
              {selectedPersonal.subtasks.map((s) => (
                <li
                  key={s.id}
                  className="group flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-[var(--bg-hover)]"
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
                      <Circle className="h-4 w-4 text-[var(--text-muted)]" />
                    )}
                  </button>
                  <span
                    className={
                      s.completed
                        ? "flex-1 text-[13px] text-[var(--text-muted)] line-through"
                        : "flex-1 text-[13px]"
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
                    <Trash2 className="h-3.5 w-3.5 text-[var(--text-faint)] hover:text-[var(--danger)]" />
                  </button>
                </li>
              ))}
            </ul>
            <form onSubmit={(e) => void onAddSub(e)} className="mt-auto flex gap-2">
              <input
                value={subTitle}
                onChange={(e) => setSubTitle(e.target.value)}
                placeholder="Add subtask"
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                className="rounded-lg border border-[var(--border)] px-2.5 text-[var(--text-muted)]"
              >
                <Plus className="h-4 w-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-[13px] text-[var(--text-faint)]">
            Select a todo to edit subtasks
          </div>
        )}
      </aside>
    </div>
  );
}
