import postgres from 'postgres';

/**
 * Quick script to check if seed data was created
 */

const getConnectionString = () => {
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

const main = async () => {
  console.log('🔍 Checking seed data...\n');

  const sql = postgres(getConnectionString());

  try {
    // Check cost codes
    const costCodes = await sql`
      SELECT COUNT(*) as count
      FROM cost_codes
      WHERE id IN ('01-100', '02-200', '03-300', '04-400', '05-500', '06-600', '07-700', '08-800', '09-900', '21-000', '22-000', '23-000', '26-000')
    `;
    console.log(`✅ Cost Codes: ${costCodes[0].count}/13 seed codes found`);

    // Check clients
    const clients = await sql`
      SELECT COUNT(*) as count, MAX(created_at) as latest
      FROM clients
    `;
    console.log(`✅ Clients: ${clients[0].count} total (latest: ${clients[0].latest})`);

    // Check projects created by seed script
    const projects = await sql`
      SELECT COUNT(*) as count
      FROM projects
      WHERE name LIKE '%Warehouse Project%'
         OR name LIKE '%Office Tower Project%'
         OR name LIKE '%Retail Center Project%'
         OR name LIKE '%Hospital Project%'
         OR name LIKE '%School Project%'
    `;
    console.log(`✅ Seed Projects: ${projects[0].count}/5 projects found`);

    // Show sample project data
    if (parseInt(projects[0].count as string) > 0) {
      const sampleProjects = await sql`
        SELECT id, name, state, city, estimated_value
        FROM projects
        WHERE name LIKE '%Warehouse Project%'
           OR name LIKE '%Office Tower Project%'
           OR name LIKE '%Retail Center Project%'
           OR name LIKE '%Hospital Project%'
           OR name LIKE '%School Project%'
        ORDER BY created_at DESC
        LIMIT 5
      `;

      console.log('\n📊 Sample Projects:');
      sampleProjects.forEach((p: any) => {
        console.log(`   - ${p.name} (${p.city}, ${p.state}) - $${(p.estimated_value / 1000000).toFixed(1)}M`);
      });
    }

    // Check budget codes
    const budgetCodes = await sql`
      SELECT COUNT(*) as count
      FROM budget_codes
    `;
    console.log(`\n✅ Budget Codes: ${budgetCodes[0].count} total`);

    // Check budget line items
    const budgetLineItems = await sql`
      SELECT COUNT(*) as count
      FROM budget_line_items
    `;
    console.log(`✅ Budget Line Items: ${budgetLineItems[0].count} total`);

    // Check commitments
    const commitments = await sql`
      SELECT COUNT(*) as count
      FROM commitments
      WHERE number LIKE 'COM-%'
    `;
    console.log(`✅ Commitments: ${commitments[0].count} seed commitments found`);

    // Check meetings
    const meetings = await sql`
      SELECT COUNT(*) as count
      FROM meetings
      WHERE title = 'Weekly Project Status Meeting'
    `;
    console.log(`✅ Meetings: ${meetings[0].count} seed meetings found`);

    console.log('\n✅ Seed data verification complete!');

  } catch (error) {
    console.error('❌ Error checking seed data:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
};

main();
