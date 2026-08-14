import "@/lib/tracker-client";
import { AuthProvider } from "@/lib/auth";
import { WorkspaceProvider } from "@/lib/workspace";
import { FocusTimerProvider } from "@/lib/focus-timer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={250}>
      <AuthProvider>
        <WorkspaceProvider>
          <FocusTimerProvider>
            {children}
            <Toaster closeButton position="bottom-right" />
          </FocusTimerProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </TooltipProvider>
  );
}
