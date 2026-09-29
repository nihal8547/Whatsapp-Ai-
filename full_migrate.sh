#!/bin/bash
echo "Wiping existing schemas..."
echo "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;" | docker exec -i wa-postgres psql -U user -d database

echo "Applying base schema..."
cat /opt/wa-dashboard/migrations/000_base_schema.sql | docker exec -i wa-postgres psql -U user -d database

echo "Applying dashboard schema..."
cat /opt/wa-dashboard/migrations/001_dashboard.sql | docker exec -i wa-postgres psql -U user -d database
cat /opt/wa-dashboard/migrations/002_ensure_columns.sql | docker exec -i wa-postgres psql -U user -d database
cat /opt/wa-dashboard/migrations/003_media_library.sql | docker exec -i wa-postgres psql -U user -d database
cat /opt/wa-dashboard/migrations/004_admin_panel.sql | docker exec -i wa-postgres psql -U user -d database
cat /opt/wa-dashboard/migrations/005_followup_review.sql | docker exec -i wa-postgres psql -U user -d database

echo "Creating dummy tenant..."
echo "INSERT INTO wa_tenants (id, name, slug) VALUES (1, 'Test Tenant', 'test') ON CONFLICT DO NOTHING;" | docker exec -i wa-postgres psql -U user -d database

echo "Creating users..."
cd /opt/wa-dashboard
docker compose exec dashboard node scripts/create-user.mjs \
  "${SUPER_ADMIN_EMAIL:-admin@example.com}" "Admin" \
  "${SUPER_ADMIN_PASSWORD:?set SUPER_ADMIN_PASSWORD before running this script}" --super
docker compose exec dashboard node scripts/create-user.mjs \
  "${TENANT_USER_EMAIL:-user@example.com}" "User" \
  "${TENANT_USER_PASSWORD:?set TENANT_USER_PASSWORD before running this script}" --tenant 1
