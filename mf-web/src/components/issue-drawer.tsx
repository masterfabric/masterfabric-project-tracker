"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Trash2,
  X,
  Plus,
  Check,
} from "lucide-react";
import { formatRelative, shortIssueId } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace";

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function IssueDrawer() {
  const {
    selectedTodo,
    setSelectedTodoId,
    updateTodoStatus,
    updateTodoTitle,
    updateTodoDue,
    deleteTodo,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    members,
  } = useWorkspace();

  const [title, setTitle] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [subTitle, setSubTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(selectedTodo?.title ?? "");
    setDueLocal(toLocalInput(selectedTodo?.dueAt ?? null));
    setSubTitle("");
  }, [selectedTodo?.id, selectedTodo?.title, selectedTodo?.dueAt]);

  if (!selectedTodo) return null;

  const assignee = members.find(
    (m) => m.userId === selectedTodo.assignedToUserId,
  );

  async function saveTitle() {
    const next = title.trim();
    if (!next || next === selectedTodo!.title) return;
    setSaving(true);
    try {
      await updateTodoTitle(selectedTodo!.id, next);
    } finally {
      setSaving(false);
    }
  }

  async function saveDue() {
    const nextIso = dueLocal ? new Date(dueLocal).toISOString() : null;
    const prev = selectedTodo!.dueAt;
    if ((nextIso ?? null) === (prev ?? null)) return;
    if (
      nextIso &&
      prev &&
      Math.abs(new Date(nextIso).getTime() - new Date(prev).getTime()) < 60_000
    ) {
      return;
    }
    setSaving(true);
    try {
      await updateTodoDue(selectedTodo!.id, nextIso);
    } finally {
      setSaving(false);
    }
  }

  async function onAddSubtask(e: FormEvent) {
    e.preventDefault();
    const t = subTitle.trim();
    if (!t) return;
    await addSubtask(selectedTodo!.id, t);
    setSubTitle("");
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close issue"
        className="mf-dim-in absolute inset-0 z-20 bg-[var(--overlay)] backdrop-blur-[2px]"
        onClick={() => setSelectedTodoId(null)}
      />
      <aside className="mf-slide-in absolute inset-y-0 right-0 z-30 flex w-full max-w-[460px] flex-col border-l border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow-lg)] md:w-[460px]">
        <header className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3.5">
          <button
            type="button"
            onClick={() =>
              void updateTodoStatus(
                selectedTodo.id,
                selectedTodo.status === "DONE" ? "OPEN" : "DONE",
              )
            }
            className="mf-btn mf-btn-ghost !p-2"
            title="Toggle status"
          >
            {selectedTodo.status === "DONE" ? (
              <CheckCircle2 className="h-4 w-4 text-[var(--done)]" />
            ) : (
              <Circle className="h-4 w-4 text-[var(--open)]" />
            )}
          </button>
          <span className="font-mono text-[12px] text-[var(--text-faint)]">
            {shortIssueId(selectedTodo.id)}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (confirm("Delete this issue?")) {
                  void deleteTodo(selectedTodo.id);
                }
              }}
              className="mf-btn mf-btn-ghost mf-btn-danger !p-2"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedTodoId(null)}
              className="mf-btn mf-btn-ghost !p-2"
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 mf-scroll">
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void saveTitle()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void saveTitle();
              }
            }}
            rows={3}
            className="w-full resize-none rounded-[var(--radius)] border border-transparent bg-transparent px-2 py-1 text-[24px] font-semibold leading-snug tracking-tight outline-none transition hover:border-[var(--border)] focus:border-[var(--border-strong)] focus:bg-[var(--bg)]"
            style={{ fontFamily: "var(--font-display)" }}
          />
          {saving ? (
            <p className="px-2 text-[12px] text-[var(--text-faint)]">Saving…</p>
          ) : (
            <p className="px-2 text-[12px] text-[var(--text-faint)]">
              ⌘/Ctrl + Enter to save · blur also saves
            </p>
          )}

          <dl className="mt-6 divide-y divide-[var(--border)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] text-[14px] shadow-[var(--shadow)]">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <dt className="text-[var(--text-faint)]">Status</dt>
              <dd
                className="rounded-lg px-2.5 py-1 text-[12px] font-semibold"
                style={{
                  background:
                    selectedTodo.status === "DONE"
                      ? "color-mix(in oklab, var(--done) 14%, transparent)"
                      : "color-mix(in oklab, var(--open) 14%, transparent)",
                  color:
                    selectedTodo.status === "DONE"
                      ? "var(--done)"
                      : "var(--open)",
                }}
              >
                {selectedTodo.status}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <dt className="text-[var(--text-faint)]">Assignee</dt>
              <dd className="text-right text-[var(--text-muted)]">
                {assignee?.userNickname ?? "Unassigned"}
                <span className="mt-0.5 block text-[11px] text-[var(--text-faint)]">
                  Set when creating the issue
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <dt className="text-[var(--text-faint)]">Due</dt>
              <dd>
                <input
                  type="datetime-local"
                  value={dueLocal}
                  onChange={(e) => setDueLocal(e.target.value)}
                  onBlur={() => void saveDue()}
                  className="mf-input !w-auto !py-1.5 !text-[12.5px]"
                />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <dt className="text-[var(--text-faint)]">Updated</dt>
              <dd className="text-[var(--text-muted)]">
                {formatRelative(selectedTodo.updatedAt)}
              </dd>
            </div>
          </dl>

          <section className="mt-7">
            <div className="mb-2.5 flex items-center justify-between px-0.5">
              <h3 className="mf-section-title">Subtasks</h3>
              <span className="font-mono text-[12px] text-[var(--text-faint)]">
                {selectedTodo.subtasks.filter((s) => s.completed).length}/
                {selectedTodo.subtasks.length}
              </span>
            </div>

            <ul className="space-y-0.5">
              {selectedTodo.subtasks.map((s) => (
                <li
                  key={s.id}
                  className="group flex items-center gap-2 rounded-[var(--radius)] px-2 py-2 hover:bg-[var(--bg-hover)]"
                >
                  <button
                    type="button"
                    onClick={() =>
                      void toggleSubtask(selectedTodo.id, s.id, !s.completed)
                    }
                    className="text-[var(--text-muted)]"
                  >
                    {s.completed ? (
                      <Check className="h-4 w-4 text-[var(--done)]" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </button>
                  <span
                    className={
                      s.completed
                        ? "flex-1 text-[14px] text-[var(--text-muted)] line-through"
                        : "flex-1 text-[14px]"
                    }
                  >
                    {s.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => void deleteSubtask(selectedTodo.id, s.id)}
                    className="opacity-0 transition group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-[var(--text-faint)] hover:text-[var(--danger)]" />
                  </button>
                </li>
              ))}
            </ul>

            <form onSubmit={onAddSubtask} className="mt-3 flex gap-2">
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
          </section>
        </div>
      </aside>
    </>
  );
}
