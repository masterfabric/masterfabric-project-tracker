"use client";

import { AuthProvider } from "@/lib/auth";
import { WorkspaceProvider } from "@/lib/workspace";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <WorkspaceProvider>{children}</WorkspaceProvider>
    </AuthProvider>
  );
}
