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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--overlay)] px-4 pt-[14vh] backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close overlay"
        className="absolute inset-0"
        onClick={onClose}
      />
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="mf-fade-up relative w-full max-w-lg rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-lg)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            className="text-[16px] font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            New issue
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="mf-btn mf-btn-ghost !p-1.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <input
          ref={inputRef}
          name="title"
          required
          placeholder="Issue title"
          className="mf-input !rounded-[var(--radius-lg)] !px-3.5 !py-3.5 !text-[16px]"
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mf-label">Assignee</span>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="mf-input"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.userNickname || m.userId.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mf-label">Due</span>
            <input
              type="datetime-local"
              value={dueLocal}
              onChange={(e) => setDueLocal(e.target.value)}
              className="mf-input"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[12.5px] text-[var(--text-faint)]">
            Same fields as the mobile create sheet
          </p>
          <button
            type="submit"
            disabled={busy}
            className="mf-btn mf-btn-primary"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
