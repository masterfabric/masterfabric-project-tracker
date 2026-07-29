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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="mf-fade-up relative w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-lg)]">
        <div className="mb-4 flex items-center justify-between">
          <h2
            className="text-[18px] font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="mf-btn mf-btn-ghost !p-1.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="space-y-2">
          {ROWS.map(([key, label]) => (
            <li
              key={key}
              className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-[14px]"
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
