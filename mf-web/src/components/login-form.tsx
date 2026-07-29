"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
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
    <div className="relative grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden border-r border-[var(--border)] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_520px_at_15%_0%,rgba(15,118,110,0.18),transparent_55%),radial-gradient(680px_420px_at_90%_100%,rgba(20,184,166,0.12),transparent_50%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.45]"
          style={{
            backgroundImage:
              "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse 70% 60% at 40% 30%, black, transparent)",
          }}
        />
        <div className="mf-noise" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <Image
              src="/tracker-mark.png"
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 rounded-[14px] shadow-[var(--shadow)] ring-1 ring-[color-mix(in_oklab,var(--accent)_30%,transparent)]"
              priority
            />
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
              MasterFabric
            </p>
          </div>
          <h1
            className="mt-8 max-w-lg text-5xl font-semibold leading-[1.02] tracking-tight text-[var(--text)] xl:text-[3.5rem]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Tracker
          </h1>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-[var(--text-muted)]">
            The same teal-on-slate workspace as mobile — list, board, and
            keyboard speed on the desktop.
          </p>
          <div className="mt-10 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow-lg)]">
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
        <ul className="relative space-y-2.5 text-[14px] text-[var(--text-muted)]">
          {[
            "Issues with assignee, due dates, and subtasks",
            "Purchases and personal todos in one shell",
            "Shortcuts: C · / · 1 2 · Esc · ?",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="relative flex items-center justify-center px-6 py-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_300px_at_70%_0%,rgba(15,118,110,0.1),transparent_60%)] lg:hidden" />
        <div className="mf-fade-up relative w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <Image
                src="/tracker-mark.png"
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 rounded-[12px]"
                priority
              />
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                MasterFabric
              </p>
            </div>
            <h1
              className="mt-4 text-4xl font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Tracker
            </h1>
          </div>

          <p className="mb-1.5 text-[13px] text-[var(--text-muted)]">
            {loginToken ? "Enter your one-time code" : "Sign in to continue"}
          </p>
          <h2
            className="mb-6 text-[26px] font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {loginToken ? "Verify" : "Welcome back"}
          </h2>

          <form onSubmit={onSubmit} className="mf-panel space-y-4 p-5">
            {!loginToken ? (
              <>
                <label className="block">
                  <span className="mf-label">Email</span>
                  <input
                    autoFocus
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mf-input"
                    placeholder="you@company.com"
                  />
                </label>
                <label className="block">
                  <span className="mf-label">Password</span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mf-input"
                    placeholder="••••••••"
                  />
                </label>
              </>
            ) : (
              <label className="block">
                <span className="mf-label">One-time code</span>
                <input
                  autoFocus
                  inputMode="numeric"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="mf-input tracking-[0.28em]"
                  placeholder="••••••"
                />
              </label>
            )}

            {error ? (
              <p className="rounded-[var(--radius)] border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--danger)_8%,transparent)] px-3 py-2.5 text-[13px] text-[var(--danger)]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="mf-btn mf-btn-primary w-full !py-2.5"
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
