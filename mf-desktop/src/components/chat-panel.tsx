"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Hash, RefreshCw, Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceSetup } from "@/components/workspace-setup";
import { formatRelative, initials, memberLabel } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

/** Shared chat chrome: rail + thread headers must match for a clean T-junction. */
const CHAT_HEADER =
  "flex h-11 shrink-0 items-center gap-2 border-b border-border px-4";

/**
 * Slack-simple org chat: channel rail + thread + composer.
 * Channels are UI filters over mf-go organizationMessages.
 */
export function ChatPanel() {
  const { user } = useAuth();
  const {
    org,
    chatMessages,
    refreshChat,
    postChatMessage,
    loading,
  } = useWorkspace();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState<"general" | "announcements">(
    "general",
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length, channel]);

  const filtered = useMemo(() => {
    if (channel === "announcements") {
      return chatMessages.filter((m) => m.body.startsWith("[announce]"));
    }
    return chatMessages.filter((m) => !m.body.startsWith("[announce]"));
  }, [chatMessages, channel]);

  async function onSend(e?: FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || !org) return;
    setBusy(true);
    try {
      const prefix = channel === "announcements" ? "[announce] " : "";
      await postChatMessage(prefix + body);
      setDraft("");
    } finally {
      setBusy(false);
    }
  }

  if (!org) {
    return <WorkspaceSetup mode="no-org" />;
  }

  const generalCount = chatMessages.filter(
    (m) => !m.body.startsWith("[announce]"),
  ).length;
  const announceCount = chatMessages.filter((m) =>
    m.body.startsWith("[announce]"),
  ).length;

  return (
    <div className="flex h-full min-h-0 bg-card">
      {/* Channel rail */}
      <aside className="flex w-[200px] shrink-0 flex-col border-r border-border bg-sidebar max-sm:w-[152px]">
        <div className={CHAT_HEADER}>
          <p
            className="min-w-0 flex-1 truncate text-[13px] leading-none font-semibold"
            title={org.name}
          >
            {org.name}
          </p>
        </div>
        <div className="flex flex-col gap-0.5 px-2 py-2.5">
          <p className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            Channels
          </p>
          {(
            [
              ["general", generalCount],
              ["announcements", announceCount],
            ] as const
          ).map(([id, count]) => (
            <button
              key={id}
              type="button"
              onClick={() => setChannel(id)}
              className={cn(
                "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] leading-none transition-colors",
                channel === id
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Hash className="size-3.5 shrink-0 opacity-70" />
              <span className="min-w-0 flex-1 truncate">{id}</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {count}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className={CHAT_HEADER}>
          <Hash className="size-4 shrink-0 text-muted-foreground" />
          <h2 className="min-w-0 truncate text-[14px] leading-none font-semibold">
            {channel}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="ml-auto shrink-0"
            onClick={() => void refreshChat()}
            aria-label="Refresh chat"
          >
            <RefreshCw className={cn(loading && "animate-spin")} />
          </Button>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          {/* px-4 matches header — avatar column aligns with # icon */}
          <div className="px-4 py-3">
            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[14px] font-medium">No messages yet</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Say hello in #{channel}.
                </p>
              </div>
            ) : (
              filtered.map((m, i) => {
                const mine = m.authorUserID === user?.id;
                const body = m.body.replace(/^\[announce\]\s*/, "");
                const author = m.authorNickname?.trim() || "Member";
                const prev = filtered[i - 1];
                const sameAuthor =
                  prev && prev.authorUserID === m.authorUserID;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex gap-2.5 rounded-md hover:bg-muted/30",
                      sameAuthor ? "py-0.5" : "mt-2.5 py-1.5 first:mt-0",
                    )}
                  >
                    {sameAuthor ? (
                      <span className="w-8 shrink-0" aria-hidden />
                    ) : (
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback className="text-[10px]">
                          {initials(memberLabel(author))}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="min-w-0 flex-1 pt-0.5">
                      {!sameAuthor ? (
                        <p className="mb-0.5 text-[13px] leading-none">
                          <span className="font-semibold">{author}</span>
                          {mine ? (
                            <span className="ml-1.5 text-[11px] text-muted-foreground">
                              you
                            </span>
                          ) : null}
                          <span className="ml-2 text-[11px] text-muted-foreground">
                            {formatRelative(m.createdAt)}
                          </span>
                        </p>
                      ) : null}
                      <p className="whitespace-pre-wrap text-[13.5px] leading-[1.45]">
                        {body}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <form
          onSubmit={(e) => void onSend(e)}
          className="shrink-0 border-t border-border px-4 py-3"
        >
          <div className="rounded-lg border border-border bg-background p-2.5 shadow-[var(--shadow)]">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSend();
                }
              }}
              placeholder={`Message #${channel}`}
              className="min-h-[44px] resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
              rows={2}
            />
            <div className="mt-1.5 flex items-center justify-end">
              <Button
                type="submit"
                size="sm"
                className="h-8 rounded-md"
                disabled={busy || !draft.trim()}
              >
                <Send data-icon="inline-start" />
                Send
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
