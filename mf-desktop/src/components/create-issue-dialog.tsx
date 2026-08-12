"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { memberLabel } from "@/lib/format";
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
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("unassigned");
  const [dueLocal, setDueLocal] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setAssignee("unassigned");
      setDueLocal("");
      const t = window.setTimeout(() => inputRef.current?.focus(), 40);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = title.trim();
    if (!next) return;
    setBusy(true);
    try {
      await onCreate({
        title: next,
        assignedToUserId: assignee === "unassigned" ? null : assignee,
        dueAt: dueLocal ? new Date(dueLocal).toISOString() : null,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass-strong sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">New issue</DialogTitle>
          <DialogDescription>
            Add a title, optional assignee, and due date.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="issue-title">Title</FieldLabel>
              <Input
                ref={inputRef}
                id="issue-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Issue title"
                className="h-11 text-[15px]"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Assignee</FieldLabel>
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {memberLabel(m.userNickname)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="issue-due">Due</FieldLabel>
                <Input
                  id="issue-due"
                  type="datetime-local"
                  value={dueLocal}
                  onChange={(e) => setDueLocal(e.target.value)}
                />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner /> : null}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
