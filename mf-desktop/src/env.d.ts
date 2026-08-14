/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GRAPHQL_URL?: string;
  readonly VITE_MF_BUNDLE_ID?: string;
  readonly VITE_MF_API_KEY?: string;
  readonly VITE_MF_PROJECT_TRACKER_PARTICULAR?: string;
  readonly VITE_GITHUB_REPO?: string;
  readonly VITE_GITHUB_TOKEN?: string;
  readonly VITE_MF_CORE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

import type { MfDesktopApi } from "../electron/preload";

declare global {
  interface Window {
    mfDesktop: MfDesktopApi;
  }
}

export {};
