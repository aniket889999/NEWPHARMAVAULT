const { MongoMemoryServer } = require('mongodb-memory-server');

async function main() {
  console.log('Starting local in-memory MongoDB on port 27017...');
  const mongod = await MongoMemoryServer.create({
    instance: {
      port: 27017,
      dbName: 'pharmavault',
      ip: '127.0.0.1'
    }
  });
  const uri = mongod.getUri();
  console.log(`Local MongoDB running at ${uri}`);
  
  process.on('SIGINT', async () => {
    await mongod.stop();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await mongod.stop();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Failed to start MongoDB Memory Server:', err);
  process.exit(1);
});
