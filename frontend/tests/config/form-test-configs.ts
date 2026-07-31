/**
 * Form Test Configurations
 *
 * Centralized configuration for all form tests.
 * Generated from FORM_INVENTORY.md and maintained as single source of truth.
 *
 * @module form-test-configs
 */

import { type FormTestConfig } from '../helpers/form-testing';
import { generateTestDataPrefix } from '../helpers/test-data-cleanup';

/**
 * Get unique test data for current run
 */
const testPrefix = generateTestDataPrefix();

/**
 * Form Test Configurations
 * Complete configuration for all 28 forms in the application
 */
export const formConfigs: FormTestConfig[] = [
  // ===================================
  // STANDALONE PAGE FORMS (7)
  // ===================================

  {
    name: 'Create Project',
    route: '/form-project',
    isModal: false,
    priority: 'high',
    authRequired: true,
    submitButtonText: /create project/i,
    successIndicator: /project created|success/i,
    screenshotPrefix: 'create-project',
    requiredFields: [
      {
        label: 'Project Name',
        type: 'text',
        testValue: `${testPrefix}Test Construction Project`,
        validation: [{ type: 'required', message: 'Project name is required' }]
      },
      {
        label: 'Project Number',
        type: 'text',
        testValue: `${testPrefix}PRJ-001`,
        validation: [{ type: 'required', message: 'Project number is required' }]
      }
    ],
    optionalFields: [
      {
        label: 'Description',
        type: 'textarea',
        testValue: 'E2E test project for form testing automation'
      },
      {
        label: 'Address',
        type: 'text',
        testValue: '123 Test Street, Test City, TS 12345'
      }
    ]
  },

  {
    name: 'Create Prime Contract',
    route: '/form-contract',
    isModal: false,
    priority: 'high',
    authRequired: true,
    submitButtonText: /create contract|submit/i,
    successIndicator: /contract created|success/i,
    screenshotPrefix: 'create-contract',
    requiredFields: [
      {
        label: /contract #/i,
        type: 'text',
        testValue: `${testPrefix}CTR-001`,
        validation: [{ type: 'required', message: 'Contract number is required' }]
      },
      {
        label: /status/i,
        type: 'select',
        testValue: 'Active'
      }
    ]
  },

  {
    name: 'Invoice Form',
    route: '/form-invoice',
    isModal: false,
    priority: 'high',
    authRequired: true,
    submitButtonText: /create invoice|submit/i,
    successIndicator: /invoice created|success/i,
    screenshotPrefix: 'invoice',
    requiredFields: [
      {
        label: 'Invoice Number',
        type: 'text',
        testValue: `${testPrefix}INV-001`
      }
    ]
  },

  {
    name: 'Purchase Order Form',
    route: '/form-purchase-order',
    isModal: false,
    priority: 'high',
    authRequired: true,
    submitButtonText: /create|submit/i,
    successIndicator: /created|success/i,
    screenshotPrefix: 'purchase-order',
    requiredFields: [
      {
        label: /po number|purchase order number/i,
        type: 'text',
        testValue: `${testPrefix}PO-001`
      }
    ]
  },

  {
    name: 'Subcontract Form',
    route: '/form-subcontracts',
    isModal: false,
    priority: 'high',
    authRequired: true,
    submitButtonText: /create|submit/i,
    successIndicator: /created|success/i,
    screenshotPrefix: 'subcontract',
    requiredFields: [
      {
        label: /contract #/i,
        type: 'text',
        testValue: `${testPrefix}SUB-001`
      }
    ]
  },

  // ===================================
  // MODAL FORMS (15+)
  // ===================================

  {
    name: 'ClientFormDialog',
    route: '/clients', // Navigate here to access modal
    isModal: true,
    modalTrigger: 'button:has-text("Add Client")',
    priority: 'medium',
    authRequired: true,
    submitButtonText: /save|create/i,
    successIndicator: /created|success/i,
    screenshotPrefix: 'client-dialog',
    requiredFields: [
      {
        label: /name/i,
        type: 'text',
        testValue: `${testPrefix}Test Client`,
        validation: [{ type: 'required', message: 'Name is required' }]
      },
      {
        label: /company/i,
        type: 'combobox',
        testValue: 'Test Company'
      }
    ]
  },

  {
    name: 'ContactFormDialog',
    route: '/contacts',
    isModal: true,
    modalTrigger: 'button:has-text("Add Contact")',
    priority: 'medium',
    authRequired: true,
    submitButtonText: /save|create/i,
    successIndicator: /created|success/i,
    screenshotPrefix: 'contact-dialog',
    requiredFields: [
      {
        label: /first name/i,
        type: 'text',
        testValue: 'Test',
        validation: [{ type: 'required', message: 'First name is required' }]
      },
      {
        label: /last name/i,
        type: 'text',
        testValue: `${testPrefix}Contact`,
        validation: [{ type: 'required', message: 'Last name is required' }]
      },
      {
        label: /email/i,
        type: 'email',
        testValue: `${testPrefix.toLowerCase()}test@example.com`,
        validation: [
          { type: 'required', message: 'Email is required' },
          { type: 'pattern', value: 'email', message: 'Valid email required' }
        ]
      }
    ]
  },

  {
    name: 'UserFormDialog',
    route: '/directory/users',
    isModal: true,
    modalTrigger: 'button:has-text("Add User")',
    priority: 'high',
    authRequired: true,
    submitButtonText: /save|create|invite/i,
    successIndicator: /created|invited|success/i,
    screenshotPrefix: 'user-dialog',
    requiredFields: [
      {
        label: /email/i,
        type: 'email',
        testValue: `${testPrefix.toLowerCase()}user@example.com`
      }
    ]
  },

  // ===================================
  // INLINE FORMS (2)
  // ===================================

  {
    name: 'InlineTeamMemberForm',
    route: '/project/[id]', // Dynamic route - need to provide project ID
    isModal: false,
    priority: 'medium',
    authRequired: true,
    submitButtonText: /add|save/i,
    successIndicator: /added|success/i,
    screenshotPrefix: 'inline-team-member',
    requiredFields: [
      {
        label: /member|person/i,
        type: 'combobox',
        testValue: 'Test User'
      },
      {
        label: /role/i,
        type: 'select',
        testValue: 'Project Manager'
      }
    ]
  },

  // ===================================
  // AUTH FORMS (4)
  // ===================================

  {
    name: 'LoginForm',
    route: '/login',
    isModal: false,
    priority: 'high',
    authRequired: false,
    submitButtonText: /sign in|login/i,
    successIndicator: /dashboard|projects/i,
    screenshotPrefix: 'login',
    requiredFields: [
      {
        label: /email/i,
        type: 'email',
        testValue: 'test@example.com',
        validation: [{ type: 'required', message: 'Email is required' }]
      },
      {
        label: /password/i,
        type: 'text', // Using text type for test password
        testValue: 'TestPassword123!',
        validation: [{ type: 'required', message: 'Password is required' }]
      }
    ]
  },

  {
    name: 'SignUpForm',
    route: '/signup',
    isModal: false,
    priority: 'high',
    authRequired: false,
    submitButtonText: /sign up|create account/i,
    successIndicator: /check your email|verify/i,
    screenshotPrefix: 'signup',
    requiredFields: [
      {
        label: /name/i,
        type: 'text',
        testValue: `${testPrefix}Test User`
      },
      {
        label: /email/i,
        type: 'email',
        testValue: `${testPrefix.toLowerCase()}signup@example.com`,
        validation: [{ type: 'required', message: 'Email is required' }]
      },
      {
        label: /^password$/i,
        type: 'text',
        testValue: 'TestPassword123!',
        validation: [
          { type: 'required', message: 'Password is required' },
          { type: 'minLength', value: 8, message: 'Password must be at least 8 characters' }
        ]
      },
      {
        label: /repeat password|confirm password/i,
        type: 'text',
        testValue: 'TestPassword123!',
        validation: [{ type: 'custom', message: 'Passwords must match' }]
      }
    ]
  },

  {
    name: 'ForgotPasswordForm',
    route: '/forgot-password',
    isModal: false,
    priority: 'medium',
    authRequired: false,
    submitButtonText: /send|reset/i,
    successIndicator: /check your email|sent/i,
    screenshotPrefix: 'forgot-password',
    requiredFields: [
      {
        label: /email/i,
        type: 'email',
        testValue: 'test@example.com'
      }
    ]
  }
];

/**
 * Get form configurations by scope
 *
 * @param scope - Test scope filter
 * @returns Filtered array of form configurations
 */
export function getFormsByScope(scope: string): FormTestConfig[] {
  const lowerScope = scope.toLowerCase();

  switch (lowerScope) {
    case 'all':
      return formConfigs;

    case 'page':
      return formConfigs.filter(f => !f.isModal && f.name !== 'LoginForm' && f.name !== 'SignUpForm' && f.name !== 'ForgotPasswordForm');

    case 'modal':
      return formConfigs.filter(f => f.isModal);

    case 'inline':
      return formConfigs.filter(f => f.name.includes('Inline'));

    case 'auth':
      return formConfigs.filter(f =>
        f.name === 'LoginForm' ||
        f.name === 'SignUpForm' ||
        f.name === 'ForgotPasswordForm' ||
        f.name === 'UpdatePasswordForm'
      );

    case 'high-priority':
    case 'high':
      return formConfigs.filter(f => f.priority === 'high');

    default:
      // Try to find specific form by name
      const kebabName = lowerScope.toLowerCase().replace(/\s+/g, '-');
      const found = formConfigs.find(f =>
        f.name.toLowerCase().replace(/\s+/g, '-') === kebabName ||
        f.name.toLowerCase() === lowerScope
      );
      return found ? [found] : [];
  }
}

/**
 * Get form configuration by name
 *
 * @param name - Form name
 * @returns Form configuration or undefined
 */
export function getFormByName(name: string): FormTestConfig | undefined {
  return formConfigs.find(f => f.name === name);
}

/**
 * Get total form count
 *
 * @returns Total number of forms configured
 */
export function getTotalFormCount(): number {
  return formConfigs.length;
}

/**
 * Get form statistics
 *
 * @returns Statistics object
 */
export function getFormStatistics() {
  return {
    total: formConfigs.length,
    page: formConfigs.filter(f => !f.isModal && !f.name.includes('Inline') && !f.name.includes('Form')).length,
    modal: formConfigs.filter(f => f.isModal).length,
    inline: formConfigs.filter(f => f.name.includes('Inline')).length,
    auth: formConfigs.filter(f => f.name.includes('Login') || f.name.includes('SignUp') || f.name.includes('Password')).length,
    highPriority: formConfigs.filter(f => f.priority === 'high').length,
    mediumPriority: formConfigs.filter(f => f.priority === 'medium').length,
    lowPriority: formConfigs.filter(f => f.priority === 'low').length
  };
}
