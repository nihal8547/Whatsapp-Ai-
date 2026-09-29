#!/bin/bash
cd /opt/wa-dashboard

echo "Stopping old containers..."
docker compose down

echo "Applying schemas to real n8n database..."
cat migrations/000_base_schema.sql | docker exec -i n8n-postgres-1 psql -U n8n -d automation_db
cat migrations/update_schema.sql | docker exec -i n8n-postgres-1 psql -U n8n -d automation_db
cat migrations/001_dashboard.sql | docker exec -i n8n-postgres-1 psql -U n8n -d automation_db
cat migrations/002_ensure_columns.sql | docker exec -i n8n-postgres-1 psql -U n8n -d automation_db
cat migrations/003_media_library.sql | docker exec -i n8n-postgres-1 psql -U n8n -d automation_db
cat migrations/004_admin_panel.sql | docker exec -i n8n-postgres-1 psql -U n8n -d automation_db
cat migrations/005_followup_review.sql | docker exec -i n8n-postgres-1 psql -U n8n -d automation_db

echo "Starting dashboard on n8n network..."
docker compose up -d --build

echo "Creating dummy tenant for UI testing..."
echo "INSERT INTO wa_tenants (id, name, slug) VALUES (1, 'Nihal Tenant', 'nihal') ON CONFLICT DO NOTHING;" | docker exec -i n8n-postgres-1 psql -U n8n -d automation_db

echo "Waiting for dashboard to start..."
sleep 5

echo "Creating dashboard users in real DB..."
docker compose exec dashboard node scripts/create-user.mjs \
  "${SUPER_ADMIN_EMAIL:-admin@example.com}" "Admin" \
  "${SUPER_ADMIN_PASSWORD:?set SUPER_ADMIN_PASSWORD before running this script}" --super
docker compose exec dashboard node scripts/create-user.mjs \
  "${TENANT_USER_EMAIL:-user@example.com}" "User" \
  "${TENANT_USER_PASSWORD:?set TENANT_USER_PASSWORD before running this script}" --tenant 1
