import { CompanyService } from '../companyService';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@supabase/supabase-js');

describe('CompanyService', () => {
  let service: CompanyService;
  let mockSupabase: any;

  beforeEach(() => {
    // Create mock Supabase client with chainable methods
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
    };

    service = new CompanyService(mockSupabase);
  });

  describe('getCompany', () => {
    it('should fetch a single company with details', async () => {
      const mockCompany = {
        id: 'company-1',
        project_id: 1,
        company_id: 'global-company-1',
        email_address: 'company@example.com',
        company_type: 'VENDOR',
        status: 'ACTIVE',
        // business_phone is derived from company.contact_phone by withBusinessPhone()
        company: {
          id: 'global-company-1',
          name: 'Test Company',
          address: '123 Main St',
          city: 'New York',
          state: 'NY',
          contact_phone: '555-1234',
        },
      };

      mockSupabase.from.mockReturnValue({
        ...mockSupabase,
        select: jest.fn().mockReturnValue({
          ...mockSupabase,
          eq: jest.fn().mockReturnValue({
            ...mockSupabase,
            eq: jest.fn().mockReturnValue({
              ...mockSupabase,
              single: jest.fn().mockResolvedValue({
                data: mockCompany,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await service.getCompany('1', 'company-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('project_companies');
      expect(result).toMatchObject(mockCompany);
    });

    it('should throw error when company not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      await expect(service.getCompany('1', 'invalid-id')).rejects.toThrow(
        'Company with ID invalid-id not found.'
      );
    });
  });

  describe('createCompany', () => {
    it('should create both global and project company records', async () => {
      const createData = {
        name: 'New Company',
        address: '456 Oak Ave',
        city: 'Boston',
        state: 'MA',
        business_phone: '555-5678',
        email_address: 'new@company.com',
        company_type: 'SUBCONTRACTOR' as const,
      };

      const mockGlobalCompany = {
        id: 'new-global-company',
        name: createData.name,
        address: createData.address,
        city: createData.city,
        state: createData.state,
      };

      const mockProjectCompany = {
        id: 'new-project-company',
        project_id: 1,
        company_id: mockGlobalCompany.id,
        email_address: createData.email_address,
        company_type: createData.company_type,
        status: 'ACTIVE',
        // business_phone is derived from company.contact_phone by withBusinessPhone()
        company: {
          ...mockGlobalCompany,
          contact_phone: createData.business_phone,
        },
      };

      // Mock companies table insert
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'companies') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockGlobalCompany,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'project_companies') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockProjectCompany,
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockSupabase;
      });

      const result = await service.createCompany('1', createData);

      expect(result).toMatchObject({
        id: mockProjectCompany.id,
        project_id: mockProjectCompany.project_id,
        company_id: mockProjectCompany.company_id,
        email_address: mockProjectCompany.email_address,
        company_type: mockProjectCompany.company_type,
        status: mockProjectCompany.status,
        business_phone: createData.business_phone,
        user_count: 0,
      });
    });
  });

  describe('canDeleteCompany', () => {
    it('should allow deletion when no users assigned', async () => {
      mockSupabase.from.mockReturnValue({
        ...mockSupabase,
        select: jest.fn().mockReturnValue({
          ...mockSupabase,
          eq: jest.fn().mockReturnValue({
            ...mockSupabase,
            eq: jest.fn().mockReturnValue({
              ...mockSupabase,
              eq: jest.fn().mockResolvedValue({
                count: 0,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await service.canDeleteCompany('1', 'company-1');

      expect(result).toEqual({ canDelete: true });
    });

    it('should prevent deletion when users are assigned', async () => {
      // Mock user count response
      mockSupabase.from.mockReturnValue({
        ...mockSupabase,
        select: jest.fn().mockReturnValue({
          ...mockSupabase,
          eq: jest.fn().mockReturnValue({
            ...mockSupabase,
            eq: jest.fn().mockReturnValue({
              ...mockSupabase,
              eq: jest.fn().mockResolvedValue({
                count: 5,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await service.canDeleteCompany('1', 'company-1');

      expect(result).toEqual({
        canDelete: false,
        reason: 'Cannot delete company: 5 users are still assigned to this company.',
      });
    });

    it('should fail loudly when the user count query fails', async () => {
      mockSupabase.from.mockReturnValue({
        ...mockSupabase,
        select: jest.fn().mockReturnValue({
          ...mockSupabase,
          eq: jest.fn().mockReturnValue({
            ...mockSupabase,
            eq: jest.fn().mockReturnValue({
              ...mockSupabase,
              eq: jest.fn().mockResolvedValue({
                count: null,
                error: { message: 'Could not find a relationship for project_directory_memberships' },
              }),
            }),
          }),
        }),
      });

      await expect(service.canDeleteCompany('1', 'company-1')).rejects.toMatchObject({
        message: 'Could not find a relationship for project_directory_memberships',
      });
    });
  });
});
