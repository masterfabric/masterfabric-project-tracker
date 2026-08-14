import { useEffect, useState } from "react";
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { Providers } from "@/components/providers";
import { LoginForm } from "@/components/login-form";
import { AppShell } from "@/components/app-shell";
import { DashboardWidget } from "@/components/dashboard-widget";
import { useAuth } from "@/lib/auth";
import {
  applyGraphqlUrlOverride,
  ensureDesktopTrackerClient,
} from "@/lib/tracker-client";
import { hydrateDesktopSession } from "@/lib/storage";

function BootGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      ensureDesktopTrackerClient();
      await hydrateDesktopSession();
      await applyGraphqlUrlOverride();
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <div className="hud-canvas flex min-h-screen items-center justify-center text-[13px] text-muted-foreground">
        Starting desktop…
      </div>
    );
  }

  return <>{children}</>;
}

function LoginRoute() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (user) return <Navigate to="/app" replace />;
  return <LoginForm />;
}

function AppRoute() {
  return <AppShell />;
}

export default function App() {
  return (
    <BootGate>
      <Providers>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/app" element={<AppRoute />} />
            <Route path="/dashboard-widget" element={<DashboardWidget />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </HashRouter>
      </Providers>
    </BootGate>
  );
}
