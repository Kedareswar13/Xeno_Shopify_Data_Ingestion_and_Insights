const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function testDb() {
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  const output = {
    connection: {},
    tables: [],
    storeData: {},
    error: null
  };

  try {
    console.log('Connecting to database...');
    const startTime = Date.now();
    await prisma.$connect();
    const endTime = Date.now();
    
    output.connection = {
      success: true,
      connectionTime: `${endTime - startTime}ms`,
      database: process.env.DATABASE_URL.split('@').pop()
    };
    console.log('✅ Connected to database successfully!');

    // List all tables with row counts
    const tables = await prisma.$queryRaw`
      SELECT 
        table_name,
        (SELECT count(*) FROM information_schema.tables t2 
         WHERE t2.table_schema = t1.table_schema 
         AND t2.table_name = t1.table_name) as exists,
        (SELECT reltuples::bigint FROM pg_class WHERE relname = t1.table_name) as estimated_rows
      FROM information_schema.tables t1
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    console.log('\n📊 Database tables:');
    output.tables = tables;
    console.table(tables);

    // Check if stores table exists and has data
    if (tables.some(t => t.table_name === 'stores')) {
      try {
        const storeCount = await prisma.store.count();
        output.storeData.count = storeCount;
        console.log(`\n🏪 Found ${storeCount} stores in the database`);
        
        if (storeCount > 0) {
          const firstStore = await prisma.store.findFirst({
            include: {
              products: { take: 1 },
              customers: { take: 1 },
              orders: { take: 1 }
            }
          });
          output.storeData.sample = firstStore;
          
          console.log('\n🔍 Sample store data:');
          console.dir(firstStore, { depth: 3, colors: true });
          
          // Check sync status
          if (firstStore.lastSyncedAt) {
            const lastSync = new Date(firstStore.lastSyncedAt);
            const now = new Date();
            const hoursSinceSync = Math.round((now - lastSync) / (1000 * 60 * 60));
            console.log(`\n⏰ Last sync was ${hoursSinceSync} hours ago (${lastSync})`);
            output.storeData.lastSync = {
              timestamp: firstStore.lastSyncedAt,
              hoursAgo: hoursSinceSync
            };
          }
        }
      } catch (err) {
        console.error('\n❌ Error querying stores table:', err);
        output.storeData.error = err.message;
      }
    } else {
      console.log('\n❌ Stores table does not exist in the database');
      output.storeData.error = 'Stores table not found';
    }

  } catch (error) {
    console.error('\n❌ Database error:', error);
    output.error = {
      message: error.message,
      code: error.code,
      meta: error.meta
    };
  } finally {
    await prisma.$disconnect();
    console.log('\n🔌 Disconnected from database');
    
    // Save output to file
    const outputFile = path.join(__dirname, 'db-test-result.json');
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`\n📄 Results saved to: ${outputFile}`);
  }
}

testDb();
