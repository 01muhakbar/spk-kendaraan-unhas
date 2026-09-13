const { sequelize, syncDatabase } = require('../models');

// CREATE IF NOT EXISTS only: never alter/drop existing tables or seed master data.
syncDatabase()
  .then(() => console.log('Missing tables prepared. Run npm run db:check to verify existing columns.'))
  .catch(error => {
    console.error('Schema preparation failed:', error.name, error.original?.code || 'UNKNOWN');
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
