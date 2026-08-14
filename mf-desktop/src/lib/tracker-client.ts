import {
  configureTrackerClient,
  setGraphqlUrl,
} from "mf-tracker-client";
import { sessionStorageAdapter } from "./storage";

let configured = false;

export function ensureDesktopTrackerClient() {
  if (configured) return;
  const graphqlUrl =
    import.meta.env.VITE_GRAPHQL_URL?.trim() ||
    "http://127.0.0.1:8080/graphql";
  configureTrackerClient({
    sessionStorage: sessionStorageAdapter,
    config: {
      graphqlUrl,
      apiKey: import.meta.env.VITE_MF_API_KEY?.trim() ?? "",
      bundleId:
        import.meta.env.VITE_MF_BUNDLE_ID?.trim() ||
        "com.masterfabric.monoExpo",
      particularKey:
        import.meta.env.VITE_MF_PROJECT_TRACKER_PARTICULAR?.trim() ||
        "project_tracker",
      platform: "desktop",
      deviceName: "mf-desktop",
    },
  });
  configured = true;
}

export async function applyGraphqlUrlOverride(): Promise<void> {
  ensureDesktopTrackerClient();
  const prefs = await window.mfDesktop?.prefs.get();
  if (prefs?.graphqlUrl?.trim()) {
    setGraphqlUrl(prefs.graphqlUrl.trim());
  }
}

ensureDesktopTrackerClient();
