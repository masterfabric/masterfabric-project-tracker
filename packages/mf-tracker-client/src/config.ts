import type { SessionStorage } from "./session-storage";

export type ClientConfig = {
  graphqlUrl: string;
  bundleId: string;
  apiKey: string;
  particularKey: string;
  /** Sent on refreshTokens — e.g. "web" | "desktop" | "macos" */
  platform: string;
  /** Human device label on refreshTokens */
  deviceName: string;
};

const DEFAULT_CONFIG: ClientConfig = {
  graphqlUrl: "http://localhost:8080/graphql",
  bundleId: "com.masterfabric.monoExpo",
  apiKey: "",
  particularKey: "project_tracker",
  platform: "web",
  deviceName: "mf-tracker-client",
};

let config: ClientConfig = { ...DEFAULT_CONFIG };
let sessionStorage: SessionStorage | null = null;

export function configureTrackerClient(options: {
  config?: Partial<ClientConfig>;
  sessionStorage: SessionStorage;
}): void {
  if (options.config) {
    config = {
      ...config,
      ...Object.fromEntries(
        Object.entries(options.config).filter(
          ([, v]) => v !== undefined && v !== null,
        ),
      ),
    } as ClientConfig;
  }
  sessionStorage = options.sessionStorage;
}

export function getClientConfig(): ClientConfig {
  return config;
}

export function getSessionStorage(): SessionStorage {
  if (!sessionStorage) {
    throw new Error(
      "mf-tracker-client: call configureTrackerClient({ sessionStorage }) before GraphQL",
    );
  }
  return sessionStorage;
}

export function graphqlUrl(): string {
  return config.graphqlUrl;
}

export function setGraphqlUrl(url: string): void {
  config = { ...config, graphqlUrl: url.trim() || config.graphqlUrl };
}
