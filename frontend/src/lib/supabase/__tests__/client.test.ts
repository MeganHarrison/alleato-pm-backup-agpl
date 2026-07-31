import { createClient, resetClient } from '../client';

// Mock the config to avoid environment variable requirements
jest.mock('../config', () => ({
  getSupabaseConfig: () => ({
    url: 'https://test.supabase.co',
    anonKey: 'test-anon-key'
  })
}));

// Mock the createBrowserClient to avoid actual Supabase connection
jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn(() => ({
    // Return a mock client object
    auth: {},
    from: jest.fn(),
    rpc: jest.fn()
  }))
}));

describe('Supabase Client Singleton', () => {
  beforeEach(() => {
    // Reset the client before each test to ensure isolation
    resetClient();
  });

  it('should return the same client instance on multiple calls', () => {
    const client1 = createClient();
    const client2 = createClient();
    const client3 = createClient();

    // All calls should return the exact same instance
    expect(client1).toBe(client2);
    expect(client2).toBe(client3);
  });

  it('should create a new client after reset', () => {
    const client1 = createClient();
    resetClient();
    const client2 = createClient();

    // After reset, a new instance should be created
    expect(client1).not.toBe(client2);
  });

  it('should maintain singleton across different imports', async () => {
    // Simulate multiple modules importing the client
    const module1 = await import('../client');
    const module2 = await import('../client');

    const client1 = module1.createClient();
    const client2 = module2.createClient();

    // Even across different module imports, should be the same instance
    expect(client1).toBe(client2);
  });
});