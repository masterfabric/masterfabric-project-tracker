import {
  IllusAuthSignIn,
  IllusAuthSignUp,
} from "@/components/auth-illustrations";
import { MasterfabricMark } from "@/components/masterfabric-mark";
import { PasswordField } from "@/components/password-field";
import { useAuth } from "@/lib/auth";
import { graphqlUrl } from "@/lib/graphql";
import { formatOperatorError } from "@/lib/operator-errors";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

type Mode = "signin" | "signup";

function authErrorMessage(err: unknown, fallback: string): string {
  const raw = formatOperatorError(err, fallback);
  const lower = raw.toLowerCase();
  if (
    lower.includes("already") ||
    lower.includes("exists") ||
    lower.includes("taken") ||
    lower.includes("duplicate")
  ) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (
    lower.includes("invalid credentials") ||
    lower.includes("incorrect password") ||
    lower.includes("user not found") ||
    lower.includes("unauthorized")
  ) {
    return "Email or password is incorrect.";
  }
  if (lower.includes("password") && lower.includes("short")) {
    return "Password must be at least 8 characters.";
  }
  return raw;
}

export function LoginForm() {
  const { login, register, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [loginToken, setLoginToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);

  function switchMode(next: Mode) {
    if (busy || next === mode) return;
    setMode(next);
    setError(null);
    setLoginToken(null);
    setOtp("");
    setFormKey((k) => k + 1);
  }

  function cancelOtp() {
    if (busy) return;
    setLoginToken(null);
    setOtp("");
    setError(null);
    setFormKey((k) => k + 1);
  }

  function validate(): string | null {
    if (loginToken) {
      if (!otp.trim()) return "Enter the verification code.";
      return null;
    }
    if (!email.trim()) return "Email is required.";
    if (!password) return "Password is required.";
    if (mode === "signup") {
      if (!displayName.trim()) return "Display name is required.";
      if (password.length < 8) {
        return "Password must be at least 8 characters.";
      }
    }
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (loginToken) {
        await verifyOtp(loginToken, otp.trim());
        navigate("/app", { replace: true });
        return;
      }

      if (mode === "signup") {
        const name = displayName.trim();
        await register(email.trim(), password, name);
        navigate("/app", { replace: true });
        return;
      }

      const result = await login(email.trim(), password);
      if (result.otpRequired) {
        if (!result.loginToken) {
          setError(
            "Two-factor verification is required, but no login token was returned. Try again or contact support.",
          );
          return;
        }
        setLoginToken(result.loginToken);
        setFormKey((k) => k + 1);
        return;
      }

      if (!result.accessToken || !result.refreshToken || !result.user) {
        setError("Sign-in did not return a session. Please try again.");
        return;
      }

      navigate("/app", { replace: true });
    } catch (err) {
      setError(
        authErrorMessage(
          err,
          mode === "signup" ? "Sign-up failed" : "Sign-in failed",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const headline = loginToken
    ? "Enter your code"
    : mode === "signup"
      ? "Create account"
      : "Welcome back";
  const support = loginToken
    ? "Use the code from your authenticator or email."
    : mode === "signup"
      ? "Same MasterFabric account on desktop, web, and mobile."
      : "Sign in to continue to Project Tracker.";

  const submitLabel = busy
    ? loginToken
      ? "Verifying…"
      : mode === "signup"
        ? "Creating account…"
        : "Signing in…"
    : loginToken
      ? "Verify"
      : mode === "signup"
        ? "Create account"
        : "Sign in";

  return (
    <div className="mf-auth-shell">
      <section className="mf-auth-hero" aria-label="MasterFabric Tracker">
        <div className="mf-auth-brand">
          <div className="mf-auth-brand-mark">
            <MasterfabricMark className="size-7" />
          </div>
          <div className="min-w-0">
            <h1 className="mf-auth-brand-wordmark">MasterFabric</h1>
            <p className="mf-auth-brand-product">Project Tracker</p>
            <p className="mf-auth-brand-tag">Desktop · web · Expo</p>
          </div>
        </div>
        <div className="mf-auth-hero-art" aria-hidden>
          {mode === "signup" ? (
            <IllusAuthSignUp className="mf-auth-hero-svg" />
          ) : (
            <IllusAuthSignIn className="mf-auth-hero-svg" />
          )}
        </div>
        <p className="mf-auth-hero-copy">
          {mode === "signup"
            ? "Create one MasterFabric account for desktop, web, and Expo."
            : "Boards, issues, and chat in one MasterFabric session."}
        </p>
        {import.meta.env.DEV ? (
          <p className="mf-auth-hero-meta">{graphqlUrl()}</p>
        ) : null}
      </section>

      <section className="mf-auth-panel">
        <div className="mf-auth-panel-inner">
          <div className="mf-auth-mobile-brand">
            <div className="mf-auth-brand-mark mf-auth-brand-mark-sm">
              <MasterfabricMark className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="mf-auth-brand-wordmark mf-auth-brand-wordmark-sm">
                MasterFabric
              </p>
              <p className="mf-auth-brand-product mf-auth-brand-product-tight">
                Project Tracker
              </p>
            </div>
          </div>

          <div className="mf-auth-panel-head" key={`head-${formKey}`}>
            <h2 className="mf-auth-panel-title">{headline}</h2>
            <p className="mf-auth-panel-support">{support}</p>
          </div>

          {!loginToken ? (
            <Tabs
              value={mode}
              onValueChange={(v) => {
                if (v === "signin" || v === "signup") switchMode(v);
              }}
              className="mb-6 w-full"
            >
              <TabsList
                className="mf-auth-tabs grid h-11 w-full grid-cols-2 gap-1 p-1"
                aria-label="Authentication mode"
              >
                <TabsTrigger
                  value="signin"
                  disabled={busy}
                  className="mf-auth-tab h-full text-[13px] font-semibold"
                >
                  Sign in
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  disabled={busy}
                  className="mf-auth-tab h-full text-[13px] font-semibold"
                >
                  Sign up
                </TabsTrigger>
              </TabsList>
            </Tabs>
          ) : null}

          <form
            key={formKey}
            onSubmit={onSubmit}
            className="flex flex-col gap-5"
            noValidate
          >
            <FieldGroup className="gap-4">
              {!loginToken ? (
                <>
                  {mode === "signup" ? (
                    <Field>
                      <FieldLabel htmlFor="displayName">Display name</FieldLabel>
                      <Input
                        id="displayName"
                        name="displayName"
                        autoFocus
                        autoComplete="name"
                        required
                        disabled={busy}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your name"
                      />
                    </Field>
                  ) : null}
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      name="email"
                      autoFocus={mode === "signin"}
                      type="email"
                      autoComplete="email"
                      required
                      disabled={busy}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <PasswordField
                      id="password"
                      name="password"
                      autoComplete={
                        mode === "signup" ? "new-password" : "current-password"
                      }
                      required
                      minLength={mode === "signup" ? 8 : undefined}
                      disabled={busy}
                      value={password}
                      onChange={setPassword}
                      groupClassName="mf-auth-password"
                    />
                    {mode === "signup" ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        At least 8 characters.
                      </p>
                    ) : null}
                  </Field>
                </>
              ) : (
                <Field>
                  <FieldLabel htmlFor="otp">Code</FieldLabel>
                  <Input
                    id="otp"
                    name="otp"
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    disabled={busy}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="tracking-[0.3em]"
                    placeholder="••••••"
                  />
                </Field>
              )}
            </FieldGroup>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-col gap-3 pt-1">
              <Button
                type="submit"
                disabled={busy}
                className="h-11 w-full"
                aria-busy={busy}
              >
                {busy ? <Spinner data-icon="inline-start" /> : null}
                {submitLabel}
                {!busy ? <ArrowRight data-icon="inline-end" /> : null}
              </Button>

              {loginToken ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  disabled={busy}
                  onClick={cancelOtp}
                >
                  Back to sign in
                </Button>
              ) : (
                <p className="text-center text-[12px] text-muted-foreground">
                  Use the tabs above to switch between Sign in and Sign up.
                </p>
              )}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
