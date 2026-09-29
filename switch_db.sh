#!/bin/bash
cd /opt/wa-dashboard

# Apply any missing dashboard schema to the automation_db just in case!
cat migrations/001_dashboard.sql | docker exec -i n8n-postgres-1 psql -U n8n -d automation_db
cat migrations/002_ensure_columns.sql | docker exec -i n8n-postgres-1 psql -U n8n -d automation_db
cat migrations/003_media_library.sql | docker exec -i n8n-postgres-1 psql -U n8n -d automation_db
cat migrations/004_admin_panel.sql | docker exec -i n8n-postgres-1 psql -U n8n -d automation_db
cat migrations/005_followup_review.sql | docker exec -i n8n-postgres-1 psql -U n8n -d automation_db

# Restart the dashboard
docker compose down
docker compose up -d

echo "Waiting for dashboard to start..."
sleep 5

# Create dashboard users in the real database (automation_db)
docker compose exec dashboard node scripts/create-user.mjs \
  "${SUPER_ADMIN_EMAIL:-admin@example.com}" "Admin" \
  "${SUPER_ADMIN_PASSWORD:?set SUPER_ADMIN_PASSWORD before running this script}" --super
docker compose exec dashboard node scripts/create-user.mjs \
  "${TENANT_USER_EMAIL:-user@example.com}" "User" \
  "${TENANT_USER_PASSWORD:?set TENANT_USER_PASSWORD before running this script}" --tenant 1
