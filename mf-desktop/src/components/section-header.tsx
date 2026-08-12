"use client";

import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  icon: Icon,
  title,
  hint,
  action,
  className,
  dense,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        "mf-section-header mf-enter",
        dense && "mf-section-header-dense",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon ? (
          <span className="mf-section-header-icon" aria-hidden>
            <Icon className="size-3.5" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="mf-section-header-title">{title}</h3>
          {hint ? <p className="mf-section-header-hint">{hint}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
