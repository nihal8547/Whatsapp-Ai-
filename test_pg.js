const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => client.query('SELECT count(*) FROM wa_messages'))
  .then(res => console.log('OK', res.rows))
  .catch(err => console.error('ERROR', err))
  .finally(() => client.end());
