const models = require('../models');

async function checkSchema() {
  try {
    for (const model of Object.values(models.sequelize.models)) {
      const columns = await models.sequelize.getQueryInterface().describeTable(model.getTableName());
      const missing = Object.values(model.getAttributes())
        .map(attribute => attribute.field)
        .filter(field => !Object.hasOwn(columns, field));
      if (missing.length) throw new Error(`${model.getTableName()}: missing ${missing.join(', ')}`);
      console.log(`${model.getTableName()}: OK`);
    }
  } catch (error) {
    console.error('Schema check failed:', error.name, error.original?.code || error.message);
    process.exitCode = 1;
  } finally {
    await models.sequelize.close();
  }
}

checkSchema();
