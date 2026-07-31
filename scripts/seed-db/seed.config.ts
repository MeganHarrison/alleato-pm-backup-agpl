import { SeedPostgres } from "@snaplet/seed/adapter-postgres";
import { defineConfig } from "@snaplet/seed/config";
import postgres from "postgres";

/**
 * Snaplet Seed Configuration for Supabase
 */

const getSupabaseConnectionString = () => {
  if (process.env.SUPABASE_DB_URL) {
    return process.env.SUPABASE_DB_URL;
  }

  const host = process.env.SUPABASE_DB_HOST || 'db.lgveqfnpkxvzbnnwuled.supabase.co';
  const port = process.env.SUPABASE_DB_PORT || '5432';
  const database = process.env.SUPABASE_DB_NAME || 'postgres';
  const user = process.env.SUPABASE_DB_USER || 'postgres';
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_PASSWORD;

  if (!password) {
    throw new Error('Missing SUPABASE_DB_PASSWORD or SUPABASE_PASSWORD environment variable');
  }

  return `postgres://${user}:${password}@${host}:${port}/${database}?sslmode=require`;
};

export default defineConfig({
  adapter: () => {
    const connectionString = getSupabaseConnectionString();
    const client = postgres(connectionString);
    return new SeedPostgres(client);
  },

  models: {
    users: {
      data: {
        email: (ctx) => `user-${ctx.seed}@example.com`,
        full_name: (ctx) => `Test User ${ctx.seed}`,
      },
    },
    projects: {
      data: {
        name: (ctx) => `Project ${ctx.seed}`,
        state: () => ['California', 'Texas', 'New York', 'Florida'][Math.floor(Math.random() * 4)],
      },
    },
    clients: {
      data: {
        name: (ctx) => `Client Company ${ctx.seed}`,
        email: (ctx) => `contact-${ctx.seed}@client.com`,
      },
    },
    companies: {
      data: {
        name: (ctx) => `Vendor Company ${ctx.seed}`,
        city: () => ['Los Angeles', 'Houston', 'New York', 'Miami'][Math.floor(Math.random() * 4)],
        state: () => ['CA', 'TX', 'NY', 'FL'][Math.floor(Math.random() * 4)],
      },
    },
    cost_code_types: {
      data: {
        code: (ctx) => `CT${String(ctx.seed).padStart(2, '0')}`,
        description: (ctx) => ['Labor', 'Materials', 'Equipment', 'Subcontractors'][ctx.seed % 4],
        category: () => ['Direct', 'Indirect'][Math.floor(Math.random() * 2)],
      },
    },
    cost_codes: {
      data: {
        id: (ctx) => String(ctx.seed).padStart(4, '0'),
        description: (ctx) => {
          const codes = [
            'General Conditions',
            'Site Work',
            'Concrete',
            'Masonry',
            'Metals',
            'Wood & Plastics',
            'Thermal & Moisture',
            'Doors & Windows',
            'Finishes',
            'Specialties',
            'Equipment',
            'Furnishings',
            'Conveying Systems',
            'Mechanical',
            'Electrical',
            'Fire Protection'
          ];
          return codes[ctx.seed % codes.length];
        },
        division_title: (ctx) => `Division ${(ctx.seed % 16) + 1}`,
      },
    },
    budget_codes: {
      data: {
        description: (ctx) => `Budget Code ${ctx.seed}`,
      },
    },
    budget_line_items: {
      data: {
        description: (ctx) => `Line Item ${ctx.seed}`,
        original_amount: () => Math.floor(Math.random() * 500000) + 10000,
        unit_qty: () => Math.floor(Math.random() * 1000) + 1,
        unit_cost: () => Math.floor(Math.random() * 1000) + 10,
        uom: () => ['EA', 'SF', 'LF', 'CY', 'LS'][Math.floor(Math.random() * 5)],
        calculation_method: () => ['unit', 'total'][Math.floor(Math.random() * 2)],
      },
    },
    contracts: {
      data: {
        title: (ctx) => `Prime Contract ${ctx.seed}`,
        contract_number: (ctx) => `C-${String(ctx.seed).padStart(5, '0')}`,
        original_contract_amount: () => Math.floor(Math.random() * 5000000) + 500000,
        status: () => ['draft', 'active', 'complete'][Math.floor(Math.random() * 3)],
        executed: () => Math.random() > 0.5,
        retention_percentage: () => [5, 10][Math.floor(Math.random() * 2)],
        apply_vertical_markup: () => Math.random() > 0.5,
      },
    },
    commitments: {
      data: {
        contract_amount: () => Math.floor(Math.random() * 1000000) + 50000,
        status: () => ['draft', 'approved', 'executed'][Math.floor(Math.random() * 3)],
        retention_percentage: () => [5, 10][Math.floor(Math.random() * 2)],
      },
    },
    change_events: {
      data: {
        title: (ctx) => `Change Event ${ctx.seed}`,
        number: (ctx) => `CE-${String(ctx.seed).padStart(4, '0')}`,
        status: () => ['pending', 'approved', 'rejected'][Math.floor(Math.random() * 3)],
        reason: () => ['Owner Request', 'Design Change', 'Field Condition', 'Code Requirement'][Math.floor(Math.random() * 4)],
        scope: (ctx) => `Description of change event ${ctx.seed}`,
      },
    },
    change_orders: {
      data: {
        title: (ctx) => `Change Order ${ctx.seed}`,
        co_number: (ctx) => `CO-${String(ctx.seed).padStart(4, '0')}`,
        description: (ctx) => `Change order description ${ctx.seed}`,
        status: () => ['draft', 'pending', 'approved', 'rejected'][Math.floor(Math.random() * 4)],
        apply_vertical_markup: () => Math.random() > 0.5,
      },
    },
    change_order_lines: {
      data: {
        description: (ctx) => `Change order line item ${ctx.seed}`,
        quantity: () => Math.floor(Math.random() * 100) + 1,
        unit_price: () => Math.floor(Math.random() * 5000) + 100,
        total_price: () => {
          const qty = Math.floor(Math.random() * 100) + 1;
          const price = Math.floor(Math.random() * 5000) + 100;
          return qty * price;
        },
        uom: () => ['EA', 'SF', 'LF', 'CY', 'LS'][Math.floor(Math.random() * 5)],
      },
    },
  },

  select: [
    // Include auth.users since many tables reference it
    'auth.users',
    // Exclude other auth tables
    '!auth.refresh_tokens',
    '!auth.sessions',
    '!auth.identities',
    '!auth.mfa_*',
    '!auth.saml_*',
    '!auth.sso_*',
    '!auth.audit_log_entries',
    '!auth.flow_state',
    '!auth.schema_migrations',
    // Exclude storage and system
    '!storage.*',
    '!pg_*',
    '!information_schema.*',
    // Exclude internal tables
    '!supabase_migrations.*',
    '!supabase_functions.*',
    '!vault.*',
    '!net.*',
    '!cron.*',
    '!realtime.*',
    '!next_auth.*',
    '!vecs.*',
    '!graphql_public.*',
  ],
});
