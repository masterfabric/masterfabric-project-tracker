"use client";

import { X } from "lucide-react";

const ROWS = [
  ["C", "Create issue"],
  ["/", "Focus search"],
  ["1", "List view"],
  ["2", "Board view"],
  ["Esc", "Close drawer / dialog"],
  ["?", "Toggle shortcuts"],
];

export function ShortcutsHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="mf-fade-up relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow)]">
        <div className="mb-4 flex items-center justify-between">
          <h2
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="space-y-2">
          {ROWS.map(([key, label]) => (
            <li
              key={key}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            >
              <span className="text-[var(--text-muted)]">{label}</span>
              <span className="mf-kbd">{key}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
