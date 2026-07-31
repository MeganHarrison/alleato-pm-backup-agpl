import { createSeedClient } from '@snaplet/seed';
import { copycat } from '@snaplet/copycat';

/**
 * Comprehensive Database Seeding Script
 *
 * Seeds Supabase with realistic test data for all core tables.
 *
 * Usage:
 *   npx tsx scripts/seed-database.ts           # Seed database
 *   npx tsx scripts/seed-database.ts --dry-run # Preview SQL only
 */

const main = async () => {
  const isDryRun = process.argv.includes('--dry-run');

  console.log(`🌱 Starting database seeding ${isDryRun ? '(DRY RUN)' : ''}...`);

  const seed = await createSeedClient({ dryRun: isDryRun });

  // Optional: Reset database (CAREFUL - deletes all data!)
  if (process.argv.includes('--reset')) {
    console.log('⚠️  Resetting database...');
    await seed.$resetDatabase();
  }

  try {
    // ============================================
    // 1. SEED COST CODES (Reference Data)
    // ============================================
    console.log('📊 Seeding cost codes...');
    await seed.cost_codes([
      { id: '01-100', description: 'General Requirements' },
      { id: '02-200', description: 'Site Work' },
      { id: '03-300', description: 'Concrete' },
      { id: '04-400', description: 'Masonry' },
      { id: '05-500', description: 'Metals' },
      { id: '06-600', description: 'Wood & Plastics' },
      { id: '07-700', description: 'Thermal & Moisture' },
      { id: '08-800', description: 'Doors & Windows' },
      { id: '09-900', description: 'Finishes' },
      { id: '21-000', description: 'Fire Suppression' },
      { id: '22-000', description: 'Plumbing' },
      { id: '23-000', description: 'HVAC' },
      { id: '26-000', description: 'Electrical' },
    ]);

    // ============================================
    // 2. SEED CLIENTS (Owners & Subcontractors)
    // ============================================
    console.log('👥 Seeding clients...');
    await seed.clients((x) => x(10, {
      name: (ctx) => `${['ABC', 'XYZ', 'Acme', 'Prime', 'Superior'][ctx.seed % 5]} ${['Construction', 'Builders', 'Contractors', 'Inc', 'LLC'][Math.floor(ctx.seed / 5)]}`,
      email: (ctx) => copycat.email(ctx.seed, { domain: 'construction.com' }),
      phone: (ctx) => copycat.phoneNumber(ctx.seed),
      client_type: (ctx) => ctx.seed === 0 ? 'owner' : 'subcontractor',
    }));

    // ============================================
    // 3. SEED PROJECTS
    // ============================================
    console.log('🏗️  Seeding projects...');
    await seed.projects((x) => x(5, (ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const projectData: any = {
        name: `${['Warehouse', 'Office Tower', 'Retail Center', 'Hospital', 'School'][ctx.seed % 5]} Project ${ctx.seed + 1}`,
        state: ['California', 'Texas', 'New York', 'Florida', 'Illinois'][ctx.seed % 5],
        city: ['San Francisco', 'Houston', 'New York', 'Miami', 'Chicago'][ctx.seed % 5],
        address: `${ctx.seed + 100} Main Street`,
        zip: `${String(90000 + ctx.seed).padStart(5, '0')}`,
        estimated_value: [2500000, 5000000, 10000000, 1500000, 3000000][ctx.seed % 5],
        stage: 'active',
      };

      // Handle column with space in name
      projectData['job number'] = `JOB-${String(ctx.seed + 1).padStart(5, '0')}`;

      return projectData;
    }));

    // ============================================
    // 4. SEED BUDGET DATA (COMPLEX)
    // ============================================
    console.log('💰 Seeding budget data...');

    // Get first project to attach budget
    const projects = await seed.$store.projects;
    if (projects.length > 0) {
      const firstProject = projects[0];

      await seed.budget_codes([
        { project_id: firstProject.id, cost_code_id: '01-100', position: 1 },
        { project_id: firstProject.id, cost_code_id: '03-300', position: 2 },
        { project_id: firstProject.id, cost_code_id: '05-500', position: 3 },
        { project_id: firstProject.id, cost_code_id: '09-900', position: 4 },
        { project_id: firstProject.id, cost_code_id: '26-000', position: 5 },
      ]);

      const budgetCodes = await seed.$store.budget_codes;

      // Add line items to each budget code
      for (const budgetCode of budgetCodes) {
        await seed.budget_line_items([
          {
            budget_code_id: budgetCode.id,
            description: `Line item for ${budgetCode.cost_code_id}`,
            original_amount: Math.floor(Math.random() * 500000) + 50000,
            calculation_method: 'lump_sum',
          },
        ]);
      }
    }

    // ============================================
    // 5. SEED COMMITMENTS (Subcontracts)
    // ============================================
    console.log('📄 Seeding commitments...');
    const allProjects = await seed.$store.projects;
    const allClients = await seed.$store.clients;

    if (allProjects.length > 0 && allClients.length > 1) {
      for (let i = 0; i < Math.min(allProjects.length, 3); i++) {
        await seed.commitments([
          {
            project_id: allProjects[i].id,
            number: `COM-${String(i + 1).padStart(3, '0')}`,
            title: `Subcontract ${i + 1}`,
            contract_company_id: allClients[i + 1].id, // Skip first client (owner)
            status: 'approved',
            original_amount: 450000 + i * 100000,
            revised_contract_amount: 450000 + i * 100000,
            accounting_method: 'amount',
            retention_percentage: 10,
            private: false,
          },
        ]);
      }
    }

    // ============================================
    // 6. SEED MEETINGS
    // ============================================
    console.log('🎤 Seeding meetings...');
    if (allProjects.length > 0) {
      await seed.meetings([
        {
          project_id: allProjects[0].id,
          title: 'Weekly Project Status Meeting',
          meeting_date: new Date(),
          duration_minutes: 60,
          attendees: ['John Doe', 'Jane Smith', 'Bob Johnson'],
        },
      ]);
    }

    console.log('✅ Seeding complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Projects: ${(await seed.$store.projects).length}`);
    console.log(`   - Clients: ${(await seed.$store.clients).length}`);
    console.log(`   - Cost Codes: ${(await seed.$store.cost_codes).length}`);
    console.log(`   - Budget Codes: ${(await seed.$store.budget_codes).length}`);
    console.log(`   - Commitments: ${(await seed.$store.commitments).length}`);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }

  process.exit(0);
};

main();
