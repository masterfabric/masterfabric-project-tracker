/**
 * Supabase Integration — Stub (Supabase removed; mf-expo uses mf-go GraphQL backend)
 * Keeps the same API so existing code (notifications, in-app-messaging) can check
 * isAvailable() and gracefully skip when Supabase is disabled.
 */

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export class SupabaseIntegration {
  private static instance: SupabaseIntegration;

  private constructor() {}

  public static getInstance(): SupabaseIntegration {
    if (!SupabaseIntegration.instance) {
      SupabaseIntegration.instance = new SupabaseIntegration();
    }
    return SupabaseIntegration.instance;
  }

  public async initialize(_config?: Partial<SupabaseConfig>): Promise<void> {
    // No-op: Supabase disabled
  }

  public getClient(): null {
    return null;
  }

  public getConfig(): null {
    return null;
  }

  public isAvailable(): boolean {
    return false;
  }

  public async signInWithEmail(_email: string, _password: string): Promise<never> {
    throw new Error('Supabase is disabled. Use mf-go GraphQL for auth.');
  }

  public async signUpWithEmail(_email: string, _password: string): Promise<never> {
    throw new Error('Supabase is disabled. Use mf-go GraphQL for auth.');
  }

  public async signOut(): Promise<void> {
    // No-op
  }

  public async getCurrentUser(): Promise<null> {
    return null;
  }

  public async getSession(): Promise<null> {
    return null;
  }

  public onAuthStateChange(_callback: (event: string, session: unknown) => void): { subscription: { unsubscribe: () => void } } {
    return { subscription: { unsubscribe: () => {} } };
  }
}

export const supabaseIntegration = SupabaseIntegration.getInstance();
