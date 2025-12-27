require('dotenv').config();
const { Client } = require('pg');
const axios = require('axios');
const fs = require('fs');

const BATCH_SIZE = 5000;
const CHECKPOINT_FILE = 'checkpoint.txt';

/* PostgreSQL */
const pgClient = new Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

/* OpenSearch */
const OPENSEARCH_URL =
  'https://vpc-email-search-uzaqvpiyheutyfluip6kc244fu.ap-south-1.es.amazonaws.com';

const AUTH = {
  username: process.env.OPENSEARCH_USER,
  password: process.env.OPENSEARCH_PASSWORD
};

const INDEX = 'email_accounts';

/* Checkpoint */
const getLastEmail = () =>
  fs.existsSync(CHECKPOINT_FILE)
    ? fs.readFileSync(CHECKPOINT_FILE, 'utf8').trim()
    : '';

const saveLastEmail = email =>
  fs.writeFileSync(CHECKPOINT_FILE, email);

async function run() {
  console.log('🔌 Connecting to PostgreSQL...');
  await pgClient.connect();
  console.log('✅ PostgreSQL connected');

  let lastEmail = getLastEmail();
  console.log(`▶️ Starting from last email: "${lastEmail}"`);

  while (true) {
    const { rows } = await pgClient.query(
      `
      SELECT email, name, role, website, linkedin, companyname
      FROM email_accounts
      WHERE email > $1
      ORDER BY email
      LIMIT $2
      `,
      [lastEmail, BATCH_SIZE]
    );

    if (rows.length === 0) {
      console.log('🎉 Indexing completed');
      break;
    }

    let bulk = '';

    for (const r of rows) {
      bulk += JSON.stringify({
        index: { _index: INDEX, _id: r.email }
      }) + '\n';

      bulk += JSON.stringify({
        email: r.email,
        name: r.name || '',
        role: r.role || '',
        companyname: r.companyname || '',
        website: r.website || '',
        linkedin: r.linkedin || ''
      }) + '\n';

      lastEmail = r.email;
    }

    bulk += '\n'; // REQUIRED

    try {
      const res = await axios.post(
        `${OPENSEARCH_URL}/_bulk`,
        bulk,
        {
          auth: AUTH,
          headers: {
            'Content-Type': 'application/x-ndjson'
          },
          maxBodyLength: Infinity,
          timeout: 60000
        }
      );

      if (res.data.errors) {
        console.error('❌ Bulk item error:', JSON.stringify(res.data.items[0], null, 2));
        process.exit(1);
      }

      saveLastEmail(lastEmail);
      console.log(`✔ Indexed up to: ${lastEmail}`);

    } catch (err) {
      console.error('❌ OpenSearch error:', err.response?.data || err.message);
      process.exit(1);
    }
  }

  await pgClient.end();
}

run().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
