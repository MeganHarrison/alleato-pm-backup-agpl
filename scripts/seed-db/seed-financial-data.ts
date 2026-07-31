import { createSeedClient } from "@snaplet/seed";

/**
 * Seed Financial Data
 *
 * Generates realistic seed data for:
 * - Commitments
 * - Change Orders
 * - Change Events
 * - Budget Codes & Line Items
 * - Contracts
 */

async function main() {
  const seed = await createSeedClient();

  // Clean up existing data (optional - comment out if you want to keep existing data)
  await seed.$resetDatabase();

  console.log("🌱 Seeding database with financial data...");

  // Seed the database
  await seed.projects((x) => x(5, {
    // For each project, create related financial data
    clients: (x) => x(1),

    // Create 3-5 cost codes per project
    cost_codes: (x) => x({ min: 3, max: 5 }),

    // Create budget codes and line items
    budget_codes: (x) => x({ min: 5, max: 10 }, {
      budget_line_items: (x) => x({ min: 2, max: 5 }),
    }),

    // Create contracts
    contracts: (x) => x({ min: 1, max: 3 }, {
      change_orders: (x) => x({ min: 0, max: 5 }, {
        change_order_lines: (x) => x({ min: 1, max: 3 }),
      }),
    }),

    // Create commitments
    commitments: (x) => x({ min: 3, max: 8 }),

    // Create change events
    change_events: (x) => x({ min: 2, max: 6 }),
  }));

  // Also seed some standalone companies for vendors
  await seed.companies((x) => x(10));

  // Seed cost code types
  await seed.cost_code_types((x) => x(4, [
    { code: 'LAB', description: 'Labor', category: 'Direct' },
    { code: 'MAT', description: 'Materials', category: 'Direct' },
    { code: 'EQP', description: 'Equipment', category: 'Direct' },
    { code: 'SUB', description: 'Subcontractors', category: 'Direct' },
  ]));

  console.log("✅ Database seeded successfully!");
  console.log("\nGenerated:");
  console.log("- 5 Projects with clients");
  console.log("- 15-25 Cost codes");
  console.log("- 25-50 Budget codes");
  console.log("- 50-250 Budget line items");
  console.log("- 5-15 Contracts");
  console.log("- 0-75 Change orders");
  console.log("- 15-40 Commitments");
  console.log("- 10-30 Change events");
  console.log("- 10 Vendor companies");
  console.log("- 4 Cost code types");

  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Error seeding database:", error);
  process.exit(1);
});
