"use client";

import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  icon: Icon,
  onClick,
  tone,
  hint,
  className,
}: {
  label: string;
  value: number | string;
  icon?: ComponentType<{ className?: string }>;
  onClick?: () => void;
  tone?: "warn" | "default";
  hint?: string;
  className?: string;
}) {
  const warn = tone === "warn" && typeof value === "number" && value > 0;
  const interactive = Boolean(onClick);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={cn(
        "mf-stat-tile mf-enter",
        interactive && "mf-stat-tile-interactive",
        warn && "mf-stat-tile-warn",
        !interactive && "cursor-default",
        className,
      )}
    >
      {Icon ? (
        <span className="mf-stat-tile-icon" aria-hidden>
          <Icon className="size-3.5" />
        </span>
      ) : null}
      <span className="mf-stat-tile-value tabular-nums">{value}</span>
      <span className="mf-stat-tile-label">{label}</span>
      {hint ? <span className="mf-stat-tile-hint">{hint}</span> : null}
    </button>
  );
}
