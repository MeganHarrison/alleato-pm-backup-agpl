import { createClient } from '@supabase/supabase-js';

/**
 * Directory Test Helpers
 * Utilities for setting up and cleaning directory test data
 */

// Initialize Supabase client for tests
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lgveqfnpkxvzbnnwuled.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxndmVxZm5wa3h2emJubnd1bGVkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTI1NDE2NiwiZXhwIjoyMDcwODMwMTY2fQ.kIFo_ZSwO1uwpttYXxjSnYbBpUhwZhkW-ZGaiQLhKmA'; // Service role for tests

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration for tests. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export interface TestUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company_id: string;
  person_type: 'user' | 'contact';
}

export interface TestProject {
  id: string;
  name: string;
  client: string;
}

export interface TestCompany {
  id: string;
  name: string;
  type: string;
}

/**
 * Clear all test data
 */
export async function clearTestData(): Promise<void> {
  // Clean up in order to respect foreign key constraints
  await supabase.from('project_directory_memberships').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('distribution_group_members').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('distribution_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('people').delete().like('email', '%test.com');
  await supabase.from('projects').delete().like('name', 'Test %');
  await supabase.from('companies').delete().like('name', '%Test%');
}

/**
 * Create a test company
 */
export async function createTestCompany(name: string, type: string = 'General Contractor'): Promise<string> {
  const { data, error } = await supabase
    .from('companies')
    .insert({
      name,
      type: type,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create test company: ${error.message}`);
  }

  return data.id;
}

/**
 * Create a test project
 */
export async function createTestProject(name: string, companyId: string): Promise<string> {
  const creationRunId = `playwright-directory-helper:${crypto.randomUUID()}`;
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name,
      client: companyId,
      type: 'construction',
      created_by: null,
      created_via: 'automation',
      creation_request_id: null,
      creation_run_id: creationRunId,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create test project: ${error.message}`);
  }

  return data.id;
}

/**
 * Create a test user (person)
 */
export async function createTestUser(
  email: string,
  firstName: string,
  lastName: string,
  companyId: string,
  personType: 'user' | 'contact' = 'user'
): Promise<string> {
  const { data, error } = await supabase
    .from('people')
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      company_id: companyId,
      person_type: personType,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  return data.id;
}

/**
 * Create a project directory membership
 */
export async function createProjectMembership(
  projectId: string,
  personId: string,
  role: string = 'User',
  permissionTemplateId?: string
): Promise<string> {
  const { data, error } = await supabase
    .from('project_directory_memberships')
    .insert({
      project_id: projectId,
      person_id: personId,
      role,
      permission_template_id: permissionTemplateId,
      status: 'active',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create project membership: ${error.message}`);
  }

  return data.id;
}

/**
 * Create a distribution group
 */
export async function createDistributionGroup(
  projectId: string,
  name: string,
  description?: string
): Promise<string> {
  const { data, error } = await supabase
    .from('distribution_groups')
    .insert({
      project_id: projectId,
      name,
      description,
      status: 'active',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create distribution group: ${error.message}`);
  }

  return data.id;
}

/**
 * Add member to distribution group
 */
export async function addGroupMember(groupId: string, personId: string): Promise<void> {
  const { error } = await supabase
    .from('distribution_group_members')
    .insert({
      group_id: groupId,
      person_id: personId,
    });

  if (error) {
    throw new Error(`Failed to add group member: ${error.message}`);
  }
}

/**
 * Create permission template
 */
export async function createPermissionTemplate(
  name: string,
  scope: 'project' | 'company' | 'global' = 'project',
  rules: Record<string, any> = {}
): Promise<string> {
  const { data, error } = await supabase
    .from('permission_templates')
    .insert({
      name,
      scope,
      rules_json: rules,
      is_system: false,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create permission template: ${error.message}`);
  }

  return data.id;
}

/**
 * Send invitation for a user
 */
export async function sendTestInvitation(
  projectId: string,
  personId: string
): Promise<{ token: string; url: string }> {
  const token = Math.random().toString(36).substring(2, 15);
  
  const { error } = await supabase
    .from('project_directory_memberships')
    .update({
      invite_token: token,
      invite_status: 'invited',
      invited_at: new Date().toISOString(),
      last_invited_at: new Date().toISOString(),
    })
    .eq('project_id', projectId)
    .eq('person_id', personId);

  if (error) {
    throw new Error(`Failed to send test invitation: ${error.message}`);
  }

  return {
    token,
    url: `/invites/${token}/accept`,
  };
}

/**
 * Get test user with full details
 */
export async function getTestUserDetails(userId: string): Promise<any> {
  const { data, error } = await supabase
    .from('people')
    .select(`
      *,
      company:companies(*),
      memberships:project_directory_memberships(*)
    `)
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to get test user details: ${error.message}`);
  }

  return data;
}

/**
 * Setup full test scenario with project, company, and users
 */
export async function setupTestScenario(): Promise<{
  company: TestCompany;
  project: TestProject;
  users: TestUser[];
  permissionTemplate: string;
}> {
  // Create company
  const companyId = await createTestCompany('Test Construction Company');
  
  // Create project
  const projectId = await createTestProject('Test Directory Project', companyId);
  
  // Create permission template
  const permissionTemplateId = await createPermissionTemplate('Project Manager', 'project', {
    directory: ['read', 'write'],
    budget: ['read', 'write'],
    contracts: ['read'],
  });
  
  // Create users
  const user1Id = await createTestUser(
    'john.doe@test.com',
    'John',
    'Doe',
    companyId,
    'user'
  );
  
  const user2Id = await createTestUser(
    'jane.smith@test.com',
    'Jane',
    'Smith',
    companyId,
    'user'
  );
  
  const contactId = await createTestUser(
    'contact@test.com',
    'Contact',
    'Person',
    companyId,
    'contact'
  );
  
  // Create project memberships
  await createProjectMembership(projectId, user1Id, 'Project Manager', permissionTemplateId);
  await createProjectMembership(projectId, user2Id, 'Foreman', permissionTemplateId);
  await createProjectMembership(projectId, contactId, 'Contact');
  
  // Create distribution group
  const groupId = await createDistributionGroup(projectId, 'Test Group', 'Test group description');
  await addGroupMember(groupId, user1Id);
  await addGroupMember(groupId, user2Id);
  
  return {
    company: { id: companyId, name: 'Test Construction Company', type: 'General Contractor' },
    project: { id: projectId, name: 'Test Directory Project', client: companyId },
    users: [
      { id: user1Id, first_name: 'John', last_name: 'Doe', email: 'john.doe@test.com', company_id: companyId, person_type: 'user' },
      { id: user2Id, first_name: 'Jane', last_name: 'Smith', email: 'jane.smith@test.com', company_id: companyId, person_type: 'user' },
      { id: contactId, first_name: 'Contact', last_name: 'Person', email: 'contact@test.com', company_id: companyId, person_type: 'contact' },
    ],
    permissionTemplate: permissionTemplateId,
  };
}

/**
 * Verify directory data matches expected Procore structure
 */
export async function verifyDirectoryStructure(projectId: string): Promise<{
  isValid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  
  try {
    // Check project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
    
    if (projectError || !project) {
      errors.push('Project not found');
    }
    
    // Check people have proper structure
    const { data: people, error: peopleError } = await supabase
      .from('people')
      .select(`
        *,
        company:companies(*),
        memberships:project_directory_memberships(*)
      `);
    
    if (peopleError) {
      errors.push('Failed to fetch people data');
    } else if (people) {
      people.forEach((person, index) => {
        if (!person.first_name || !person.last_name) {
          errors.push(`Person ${index + 1} missing required name fields`);
        }
        if (person.person_type !== 'user' && person.person_type !== 'contact') {
          errors.push(`Person ${index + 1} has invalid person_type`);
        }
        if (!person.company) {
          errors.push(`Person ${index + 1} missing company association`);
        }
      });
    }
    
    // Check permission templates exist
    const { data: templates, error: templatesError } = await supabase
      .from('permission_templates')
      .select('*');
    
    if (templatesError || !templates || templates.length === 0) {
      errors.push('No permission templates found');
    }
    
  } catch (error) {
    errors.push(`Database verification failed: ${error}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Performance test: Create large dataset
 */
export async function createLargeTestDataset(
  userCount: number = 1000,
  companyCount: number = 50
): Promise<{ users: string[]; companies: string[] }> {
  const companies: string[] = [];
  const users: string[] = [];
  
  // Create companies
  for (let i = 0; i < companyCount; i++) {
    const companyId = await createTestCompany(`Test Company ${i + 1}`);
    companies.push(companyId);
  }
  
  // Create users across companies
  for (let i = 0; i < userCount; i++) {
    const companyId = companies[i % companyCount];
    const userId = await createTestUser(
      `user${i + 1}@test.com`,
      `User${i + 1}`,
      `LastName${i + 1}`,
      companyId
    );
    users.push(userId);
  }
  
  return { users, companies };
}
