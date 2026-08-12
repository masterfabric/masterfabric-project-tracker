"use client";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { keyCombo } from "@/lib/platform";

const VIEW_ROWS: [string, string][] = [
  ["C", "Create issue"],
  ["/", "Focus search"],
  ["1", "List view"],
  ["2", "Board view"],
  ["3", "Timeline view"],
  ["Esc", "Close drawer / dialog"],
  ["?", "Toggle this panel"],
];

const APP_ROWS: [string, string][] = [
  [keyCombo(["mod", "K"]), "Command palette"],
  [keyCombo(["mod", "N"]), "New issue"],
  [keyCombo(["mod", ","]), "Settings"],
  [keyCombo(["mod", "1"]), "List view"],
  [keyCombo(["mod", "2"]), "Board view"],
  [keyCombo(["mod", "3"]), "Timeline view"],
  [keyCombo(["mod", "shift", "F"]), "Toggle focus timer"],
  [keyCombo(["mod", "shift"]) + " Space", "Show / hide window (anywhere)"],
];

function Row({ shortcut, label }: { shortcut: string; label: string }) {
  return (
    <li className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/25 px-3.5 py-2.5 text-[14px]">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant="outline" className="rounded-md font-mono">
        {shortcut}
      </Badge>
    </li>
  );
}

export function ShortcutsHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass-strong max-h-[85vh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading">Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              In view
            </p>
            <ul className="flex flex-col gap-2">
              {VIEW_ROWS.map(([key, label]) => (
                <Row key={label} shortcut={key} label={label} />
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              App
            </p>
            <ul className="flex flex-col gap-2">
              {APP_ROWS.map(([key, label]) => (
                <Row key={label} shortcut={key} label={label} />
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
