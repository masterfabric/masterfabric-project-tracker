"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { graphqlUrl } from "@/lib/graphql";

export function LoginForm() {
  const { login, verifyOtp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loginToken, setLoginToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (loginToken) {
        await verifyOtp(loginToken, otp.trim());
        router.replace("/");
        return;
      }
      const result = await login(email.trim(), password);
      if (result.otpRequired) {
        setLoginToken(result.loginToken ?? null);
        return;
      }
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
      <section className="relative hidden overflow-hidden border-r border-[var(--border)] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_500px_at_20%_10%,rgba(91,141,239,0.22),transparent_55%),radial-gradient(700px_420px_at_80%_90%,rgba(52,211,153,0.1),transparent_50%)]" />
        <div className="mf-noise" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <Image
              src="/tracker-mark.png"
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 rounded-xl ring-1 ring-[color-mix(in_oklab,var(--accent)_35%,transparent)]"
              priority
            />
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--text-faint)]">
              MasterFabric
            </p>
          </div>
          <h1
            className="mt-6 max-w-lg text-5xl font-semibold leading-[1.05] tracking-tight text-[var(--text)] xl:text-6xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Tracker
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[var(--text-muted)]">
            A desktop-first issue workspace — list, board, and keyboard speed
            on the same GraphQL graph as mobile.
          </p>
          <div className="mt-10 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)]/40 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.55)]">
            <Image
              src="/og.png"
              alt="MasterFabric Tracker workspace preview"
              width={1200}
              height={630}
              className="h-auto w-full"
              priority
            />
          </div>
        </div>
        <ul className="relative space-y-3 text-sm text-[var(--text-muted)]">
          {[
            "Dense list + kanban without the clutter",
            "Issue drawer with subtasks and status",
            "Shortcuts that feel native: C / 1 2 Esc",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="relative flex items-center justify-center px-6 py-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_320px_at_70%_0%,rgba(91,141,239,0.12),transparent_60%)] lg:hidden" />
        <div className="mf-fade-up relative w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <Image
                src="/tracker-mark.png"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 rounded-lg"
                priority
              />
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--text-faint)]">
                MasterFabric
              </p>
            </div>
            <h1
              className="mt-3 text-4xl font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Tracker
            </h1>
          </div>

          <p className="mb-2 text-sm text-[var(--text-muted)]">
            {loginToken ? "Enter your one-time code" : "Sign in to continue"}
          </p>
          <h2
            className="mb-6 text-2xl font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {loginToken ? "Verify" : "Welcome back"}
          </h2>

          <form onSubmit={onSubmit} className="mf-panel space-y-4 p-5">
            {!loginToken ? (
              <>
                <label className="block space-y-1.5">
                  <span className="text-[11px] text-[var(--text-faint)]">
                    Email
                  </span>
                  <input
                    autoFocus
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 outline-none transition focus:border-[var(--accent)]"
                    placeholder="you@company.com"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[11px] text-[var(--text-faint)]">
                    Password
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 outline-none transition focus:border-[var(--accent)]"
                    placeholder="••••••••"
                  />
                </label>
              </>
            ) : (
              <label className="block space-y-1.5">
                <span className="text-[11px] text-[var(--text-faint)]">
                  One-time code
                </span>
                <input
                  autoFocus
                  inputMode="numeric"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 tracking-[0.28em] outline-none transition focus:border-[var(--accent)]"
                  placeholder="••••••"
                />
              </label>
            )}

            {error ? (
              <p className="rounded-lg border border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.08)] px-3 py-2 text-sm text-[var(--danger)]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
            >
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {loginToken ? "Verify & continue" : "Sign in"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] text-[var(--text-faint)]">
            API · <span className="font-mono">{graphqlUrl()}</span>
          </p>
        </div>
      </section>
    </div>
  );
}
