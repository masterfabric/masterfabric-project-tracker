import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !user) navigate("/login", { replace: true });
  }, [ready, user, navigate]);

  if (!ready) {
    return (
      <div className="hud-canvas flex min-h-screen flex-col items-center justify-center gap-3">
        <Skeleton className="h-4 w-40 rounded-full" />
        <p className="text-[13px] text-muted-foreground">Loading workspace…</p>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}
