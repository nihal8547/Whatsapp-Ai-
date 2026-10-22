import pg from "pg";

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgresql://wa_saas_user:f9abd85ead55ece664035169f24e4b343f9be8c222e8c167@127.0.0.1:5432/wa_saas",
});

async function run() {
  await client.connect();

  await client.query(`
    ALTER TABLE wa_plans ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE wa_plans ADD COLUMN IF NOT EXISTS broadcast_limit integer DEFAULT 100;
    ALTER TABLE wa_plans ADD COLUMN IF NOT EXISTS is_popular boolean DEFAULT false;
  `);

  await client.query(`
    UPDATE wa_plans SET 
      name = 'Starter Plan',
      price_qar = 299.00,
      monthly_reply_limit = 1000,
      broadcast_limit = 100,
      is_popular = false,
      features = $1::jsonb
    WHERE code = 'starter'
  `, [
    JSON.stringify([
      "1 WhatsApp Number Connection",
      "1,000 AI Bot Replies / month",
      "100 Daily Broadcast Recipients",
      "Appointments and Booking Engine",
      "FAQ Knowledge Base",
      "Media Library (50MB)",
      "Basic Dashboard Analytics",
      "Email and Ticket Support"
    ])
  ]);

  await client.query(`
    UPDATE wa_plans SET 
      name = 'Pro Growth',
      price_qar = 599.00,
      monthly_reply_limit = 5000,
      broadcast_limit = 500,
      is_popular = true,
      features = $1::jsonb
    WHERE code = 'pro'
  `, [
    JSON.stringify([
      "1 WhatsApp Number Connection",
      "5,000 AI Bot Replies / month",
      "500 Daily Broadcast Recipients",
      "Orders, Cart and Live Inventory",
      "Catalog and Menu Management",
      "Appointments and Resource Booking",
      "Lead Management and CRM Pipeline",
      "Ad Playbooks (Click-to-WA Campaigns)",
      "Priority WhatsApp Support"
    ])
  ]);

  await client.query(`
    UPDATE wa_plans SET 
      name = 'Business Enterprise',
      price_qar = 1199.00,
      monthly_reply_limit = 20000,
      broadcast_limit = 2000,
      is_popular = false,
      features = $1::jsonb
    WHERE code = 'business'
  `, [
    JSON.stringify([
      "Unlimited Team Members",
      "20,000 AI Bot Replies / month",
      "2,000 Daily Broadcast Recipients",
      "Full Suite: Orders, Catalog, Booking, CRM",
      "Ad Playbooks and Campaign Attribution",
      "Custom Business Pack and Prompts",
      "Dedicated Account Manager",
      "High-Throughput Delivery Engine",
      "24/7 Priority Emergency Support"
    ])
  ]);

  await client.query(`
    UPDATE wa_plans SET 
      name = '14-Day Free Trial',
      price_qar = 0.00,
      monthly_reply_limit = 200,
      broadcast_limit = 20,
      is_popular = false,
      features = $1::jsonb
    WHERE code = 'trial'
  `, [
    JSON.stringify([
      "Full Access for 14 Days",
      "200 Free AI Bot Replies",
      "20 Daily Test Broadcasts",
      "Connect Official WhatsApp Number",
      "Try Orders, Booking and Catalog"
    ])
  ]);

  console.log("Plans updated successfully!");
  await client.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
