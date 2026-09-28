#!/bin/bash
cd /opt/wa-dashboard

echo "Stopping old containers..."
docker compose down

echo "Applying schemas to real n8n database..."
cat migrations/000_base_schema.sql | docker exec -i n8n-postgres-1 psql -U n8n -d n8n
cat migrations/update_schema.sql | docker exec -i n8n-postgres-1 psql -U n8n -d n8n
cat migrations/001_dashboard.sql | docker exec -i n8n-postgres-1 psql -U n8n -d n8n

echo "Starting dashboard on n8n network..."
docker compose up -d --build

echo "Creating dummy tenant for UI testing..."
echo "INSERT INTO wa_tenants (id, name, slug) VALUES (1, 'Nihal Tenant', 'nihal') ON CONFLICT DO NOTHING;" | docker exec -i n8n-postgres-1 psql -U n8n -d n8n

echo "Waiting for dashboard to start..."
sleep 5

echo "Creating dashboard users in real DB..."
docker compose exec dashboard node scripts/create-user.mjs admin@webbea.qa 'Admin' admin123 --super
docker compose exec dashboard node scripts/create-user.mjs nihal@webbea.qa 'Nihal' password123 --tenant 1
