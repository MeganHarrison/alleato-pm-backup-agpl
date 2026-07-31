export interface MockUser {
  id: string;
  email: string;
  user_metadata: {
    full_name: string;
  };
}

export interface MockSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: MockUser | null;
}

export interface MockAuthState {
  user: MockUser | null;
  session: MockSession | null;
  isAuthenticated: boolean;
}

interface MockSupabaseClient {
  auth: Record<string, unknown>;
  from: (...args: unknown[]) => unknown;
}

declare global {
  interface Window {
    mockUser?: MockUser;
    mockSession?: MockSession;
    __MOCK_AUTH__?: MockAuthState;
    __supabaseMock__?: MockSupabaseClient;
  }
}

export {};
