import { createSeedClient } from "@snaplet/seed";

/**
 * Seed Project Financial Data
 *
 * Generates realistic financial data for a specific project.
 * Use this to add financial data to an existing project.
 *
 * Usage:
 *   npx tsx scripts/seed-project-financial-data.ts [projectId]
 */

async function main() {
  const projectId = parseInt(process.argv[2] || "1");

  console.log(`🌱 Seeding financial data for project ${projectId}...`);

  const seed = await createSeedClient();

  // Generate budget structure
  console.log("Creating budget codes and line items...");
  await seed.budget_codes((x) => x(10, {
    project_id: projectId,
    budget_line_items: (x) => x({ min: 2, max: 4 }),
  }));

  // Generate contracts
  console.log("Creating contracts with change orders...");
  await seed.contracts((x) => x(2, {
    project_id: projectId,
    change_orders: (x) => x({ min: 1, max: 3 }, {
      project_id: projectId,
      change_order_lines: (x) => x({ min: 1, max: 4 }, {
        project_id: projectId,
      }),
    }),
  }));

  // Generate commitments
  console.log("Creating commitments...");
  await seed.commitments((x) => x(5, {
    project_id: projectId,
  }));

  // Generate change events
  console.log("Creating change events...");
  await seed.change_events((x) => x(4, {
    project_id: projectId,
  }));

  console.log("✅ Project financial data seeded successfully!");
  console.log("\nGenerated for project", projectId);
  console.log("- 10 Budget codes");
  console.log("- 20-40 Budget line items");
  console.log("- 2 Contracts");
  console.log("- 2-6 Change orders");
  console.log("- 5 Commitments");
  console.log("- 4 Change events");

  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Error seeding database:", error);
  console.error(error.stack);
  process.exit(1);
});
