#!/bin/bash
cd /opt/wa-dashboard

# Apply any missing dashboard schema to the automation_db just in case!
cat migrations/001_dashboard.sql | docker exec -i n8n-postgres-1 psql -U n8n -d automation_db

# Restart the dashboard
docker compose down
docker compose up -d

echo "Waiting for dashboard to start..."
sleep 5

# Create dashboard users in the real database (automation_db)
docker compose exec dashboard node scripts/create-user.mjs admin@webbea.qa 'Admin' admin123 --super
docker compose exec dashboard node scripts/create-user.mjs nihal@webbea.qa 'Nihal' password123 --tenant 1
