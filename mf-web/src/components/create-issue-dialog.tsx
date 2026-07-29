"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { ProjectMember } from "@/lib/types";

export function CreateIssueDialog({
  open,
  onClose,
  onCreate,
  members,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    assignedToUserId?: string | null;
    dueAt?: string | null;
  }) => Promise<void>;
  members: ProjectMember[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [assignee, setAssignee] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setAssignee("");
      setDueLocal("");
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") ?? "").trim();
    if (!title) return;
    setBusy(true);
    try {
      await onCreate({
        title,
        assignedToUserId: assignee || null,
        dueAt: dueLocal ? new Date(dueLocal).toISOString() : null,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-[14vh] backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close overlay"
        className="absolute inset-0"
        onClick={onClose}
      />
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="mf-fade-up relative w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-[var(--shadow)]"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2
            className="text-sm font-medium"
            style={{ fontFamily: "var(--font-display)" }}
          >
            New issue
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <input
          ref={inputRef}
          name="title"
          required
          placeholder="Issue title"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-3 text-base outline-none focus:border-[var(--accent)]"
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-[11px] text-[var(--text-faint)]">Assignee</span>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.userNickname || m.userId.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] text-[var(--text-faint)]">Due</span>
            <input
              type="datetime-local"
              value={dueLocal}
              onChange={(e) => setDueLocal(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-[var(--text-faint)]">
            Same fields as mobile create sheet
          </p>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
