"use client";

import { FormEvent, useState } from "react";
import {
  Crown,
  Mail,
  Shield,
  User,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { WorkspaceSetup } from "@/components/workspace-setup";
import { cn } from "@/lib/utils";
import { initials, orgMemberLabel } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";

function roleIcon(role: string) {
  if (role === "OWNER") return <Crown className="size-3.5 text-foreground" />;
  if (role === "ADMIN") return <Shield className="size-3.5 text-muted-foreground" />;
  return <User className="size-3.5 text-muted-foreground" />;
}

export function TeamPanel() {
  const { user } = useAuth();
  const { org, orgMembers, inviteToOrg, invitations, acceptInvite, declineInvite } =
    useWorkspace();
  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setBusy(true);
    try {
      await inviteToOrg(email);
      setInviteEmail("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } finally {
      setBusy(false);
    }
  }

  if (!org) {
    return <WorkspaceSetup mode="no-org" />;
  }

  const active = orgMembers.filter((m) => m.membershipStatus === "ACTIVE");
  const suspended = orgMembers.filter((m) => m.membershipStatus === "SUSPENDED");

  return (
    <div className="flex h-full flex-col">
      <div className="mf-panel-header">
        <h2 className="mf-panel-title">Team</h2>
        <p className="mf-panel-sub">
          {org.name} &middot; {active.length} member{active.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="border-b border-border/70 bg-card/40 px-5 py-4">
        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Invite member
        </p>
        <form onSubmit={(e) => void onInvite(e)} className="flex gap-2">
          <Input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@company.com"
            type="email"
            className="h-9 min-w-0 flex-1 rounded-xl"
          />
          <Button
            type="submit"
            size="sm"
            disabled={busy}
            className="h-9 rounded-xl"
          >
            <UserPlus className="mr-1.5 size-3.5" />
            Invite
          </Button>
        </form>
        {success && (
          <p className="mt-2 text-[12px] text-emerald-600">Invitation sent!</p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 mf-scroll">
        {invitations.length > 0 && (
          <section className="mb-6">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Pending invitations
            </p>
            <ul className="space-y-1">
              {invitations.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-3 py-2.5"
                >
                  <Mail className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {inv.organizationName || "Organization"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      from {inv.inviterNickname || "someone"}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-7 rounded-full text-[11px]"
                      onClick={() => void acceptInvite(inv.id)}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-full text-[11px]"
                      onClick={() => void declineInvite(inv.id)}
                    >
                      Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Active members
          </p>
          <ul className="space-y-0.5">
            {active.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-muted/40"
              >
                <Avatar>
                  <AvatarFallback className="text-[10px]">
                    {initials(orgMemberLabel(m, user))}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {orgMemberLabel(m, user)}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Joined {new Date(m.joinedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {roleIcon(m.role)}
                  <Badge variant="secondary" className="rounded-full text-[10px]">
                    {m.role}
                  </Badge>
                </div>
              </li>
            ))}
            {active.length === 0 && (
              <p className="px-3 py-4 text-center text-[13px] text-muted-foreground">
                No active members.
              </p>
            )}
          </ul>
        </section>

        {suspended.length > 0 && (
          <section className="mt-6">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Suspended
            </p>
            <ul className="space-y-0.5">
              {suspended.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 opacity-50"
                >
                  <Avatar>
                    <AvatarFallback className="text-[10px]">
                      {initials(orgMemberLabel(m, user))}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-[13px]">
                    {orgMemberLabel(m, user)}
                  </span>
                  <Badge variant="outline" className="ml-auto rounded-full text-[10px]">
                    Suspended
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
