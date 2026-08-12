export function shortIssueId(id: string) {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

/** True for UUIDs / hex ids — never show these as people names. */
export function isUuidLike(value: string) {
  const s = value.trim();
  if (!s) return false;
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  ) {
    return true;
  }
  // Truncated uuid prefixes like "4d080a12"
  return /^[0-9a-f]{6,}$/i.test(s) && !/[g-z]/i.test(s);
}

/**
 * Prefer a real nickname/display name/email local-part; never fall back to raw user ids.
 */
export function memberLabel(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const v = candidate?.trim();
    if (!v || isUuidLike(v)) continue;
    // Email → show local part when it's the only signal
    if (v.includes("@")) {
      const local = v.split("@")[0]?.trim();
      if (local && !isUuidLike(local)) return local;
      continue;
    }
    return v;
  }
  return "Team member";
}

export type MemberNameSource = {
  userID?: string;
  userId?: string;
  userNickname?: string;
  userDisplayName?: string;
  userEmail?: string;
};

/** Org/project member → best available display label. */
export function orgMemberLabel(
  m: MemberNameSource | null | undefined,
  self?: { id: string; displayName?: string; email?: string } | null,
): string {
  if (!m) return "Team member";
  const uid = m.userID || m.userId;
  if (self && uid && self.id === uid) {
    return memberLabel(self.displayName, self.email, "You");
  }
  return memberLabel(m.userNickname, m.userDisplayName, m.userEmail);
}

export function resolveMemberName(
  userId: string | null | undefined,
  opts: {
    orgMembers?: MemberNameSource[];
    projectMembers?: MemberNameSource[];
    self?: { id: string; displayName?: string; email?: string } | null;
  },
): string {
  if (!userId) return "Unassigned";
  if (opts.self?.id === userId) {
    return memberLabel(opts.self.displayName, opts.self.email, "You");
  }
  const org = opts.orgMembers?.find(
    (m) => (m.userID || m.userId) === userId,
  );
  if (org) {
    const label = orgMemberLabel(org, opts.self);
    if (label !== "Team member") return label;
  }
  const proj = opts.projectMembers?.find(
    (m) => (m.userId || m.userID) === userId,
  );
  if (proj) {
    const label = orgMemberLabel(proj, opts.self);
    if (label !== "Team member") return label;
  }
  return "Team member";
}

export function initials(name: string) {
  if (isUuidLike(name) || name === "Team member") {
    // Still produce initials for "Team member"
    if (name === "Team member") return "TM";
    return "?";
  }
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function formatDue(dueAt: string | null) {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatRelative(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
