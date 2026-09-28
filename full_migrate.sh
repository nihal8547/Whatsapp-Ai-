#!/bin/bash
echo "Wiping existing schemas..."
echo "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;" | docker exec -i wa-postgres psql -U user -d database

echo "Applying base schema..."
cat /opt/wa-dashboard/migrations/000_base_schema.sql | docker exec -i wa-postgres psql -U user -d database

echo "Applying dashboard schema..."
cat /opt/wa-dashboard/migrations/001_dashboard.sql | docker exec -i wa-postgres psql -U user -d database

echo "Creating dummy tenant..."
echo "INSERT INTO wa_tenants (id, name, slug) VALUES (1, 'Test Tenant', 'test') ON CONFLICT DO NOTHING;" | docker exec -i wa-postgres psql -U user -d database

echo "Creating users..."
cd /opt/wa-dashboard
docker compose exec dashboard node scripts/create-user.mjs admin@webbea.qa 'Admin' admin123 --super
docker compose exec dashboard node scripts/create-user.mjs nihal@webbea.qa 'Nihal' password123 --tenant 1
