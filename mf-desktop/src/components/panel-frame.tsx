"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PanelFrame({
  children,
  className,
  header,
  footer,
}: {
  children?: ReactNode;
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className={cn("mf-panel-frame mf-enter", className)}>
      {header ? <div className="mf-panel-frame-head">{header}</div> : null}
      {children}
      {footer ? <div className="mf-panel-frame-foot">{footer}</div> : null}
    </section>
  );
}
