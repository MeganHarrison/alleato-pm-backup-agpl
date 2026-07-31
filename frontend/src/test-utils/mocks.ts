/**
 * Shared mock data and utilities for tests
 */

// Mock Supabase client with chainable methods
export const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  like: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  contains: jest.fn().mockReturnThis(),
  containedBy: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  filter: jest.fn().mockReturnThis(),
  match: jest.fn().mockReturnThis(),
  textSearch: jest.fn().mockReturnThis(),
  csv: jest.fn().mockReturnThis(),
  geojson: jest.fn().mockReturnThis(),
  explain: jest.fn().mockReturnThis(),
  rollback: jest.fn().mockReturnThis(),
  returns: jest.fn().mockReturnThis(),
};

// Mock project data
export const mockProject = {
  id: 1,
  name: "Test Project",
  client: "Test Client",
  state: "construction",
  "job number": "JP-001",
  address: "123 Main St",
  city: "Indianapolis",
  country_state: "United States - Indiana",
  zip: "46202",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

// Mock company data
export const mockCompany = {
  id: "company-1",
  name: "Test Company",
  address: "456 Oak Ave",
  city: "Indianapolis",
  country_state: "United States - Indiana",
  zip: "46250",
  business_phone: "(317) 555-1234",
  email_address: "contact@testcompany.com",
  company_type: "VENDOR",
  status: "ACTIVE",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

// Mock user/person data
export const mockPerson = {
  id: "person-1",
  first_name: "John",
  last_name: "Doe",
  email: "john.doe@example.com",
  phone_mobile: "(317) 555-5678",
  job_title: "Project Manager",
  person_type: "user",
  company_id: "company-1",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

// Mock API responses
export const mockApiResponses = {
  health: {
    status: "healthy",
    backend: {
      connected: true,
      openai_configured: true,
    },
    timestamp: "2024-01-01T00:00:00Z",
  },
  projects: {
    data: [mockProject],
    meta: {
      page: 1,
      limit: 100,
      total: 1,
      totalPages: 1,
    },
  },
  companies: {
    data: [mockCompany],
    pagination: {
      current_page: 1,
      per_page: 25,
      total: 1,
      total_pages: 1,
    },
  },
};

// Helper to reset all mocks
export const resetAllMocks = () => {
  Object.values(mockSupabaseClient).forEach((mock) => {
    if (typeof mock === "function" && "mockClear" in mock) {
      mock.mockClear();
      mock.mockReturnThis();
    }
  });
};

// Helper to create a resolved mock value
export const createResolvedMock = <T>(
  data: T,
  error: null | { message: string } = null,
) => ({
  data,
  error,
  count: Array.isArray(data) ? data.length : null,
});
