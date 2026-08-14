"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MetaRow({
  label,
  value,
  mono,
  trailing,
  className,
  onClick,
}: {
  label?: ReactNode;
  value?: ReactNode;
  mono?: boolean;
  trailing?: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      {label != null ? (
        <span className={cn("mf-meta-row-label", mono && "font-mono")}>
          {label}
        </span>
      ) : null}
      {value != null ? (
        <span className="mf-meta-row-value min-w-0 flex-1 truncate">{value}</span>
      ) : null}
      {trailing ? (
        <span className="mf-meta-row-trailing shrink-0">{trailing}</span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn("mf-meta-row mf-meta-row-interactive", className)}
      >
        {body}
      </button>
    );
  }

  return <div className={cn("mf-meta-row", className)}>{body}</div>;
}
