"use client";

import { FormEvent, useEffect, useRef } from "react";
import { X } from "lucide-react";

export function CreateIssueDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
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
    await onCreate(title);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-[18vh] backdrop-blur-sm">
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
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-[var(--text-faint)]">
            <span className="mf-kbd">Enter</span> create ·{" "}
            <span className="mf-kbd">Esc</span> cancel
          </p>
          <button
            type="submit"
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
