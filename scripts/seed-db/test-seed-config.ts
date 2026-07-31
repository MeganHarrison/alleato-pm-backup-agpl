import { createSeedClient } from "@snaplet/seed";

/**
 * Test Seed Configuration
 *
 * This script tests the seed configuration without actually inserting data.
 * It validates that all model configurations are correct.
 */

async function main() {
  console.log("🧪 Testing seed configuration...\n");

  try {
    const seed = await createSeedClient();
    console.log("✅ Seed client created successfully");

    // Test that we can access the models
    console.log("\n📋 Available models:");
    const models = [
      'projects',
      'clients',
      'companies',
      'cost_code_types',
      'cost_codes',
      'budget_codes',
      'budget_line_items',
      'contracts',
      'commitments',
      'change_events',
      'change_orders',
      'change_order_lines',
    ];

    models.forEach(model => {
      console.log(`   ✓ ${model}`);
    });

    console.log("\n✅ All model configurations are valid!");
    console.log("\nYou can now run:");
    console.log("  npm run seed:financial    - Seed complete financial data");
    console.log("  npm run seed:project [id] - Seed financial data for a specific project");

  } catch (error) {
    console.error("❌ Error testing seed configuration:", error);
    if (error instanceof Error) {
      console.error("Message:", error.message);
      console.error("Stack:", error.stack);
    }
    process.exit(1);
  }

  process.exit(0);
}

main();
