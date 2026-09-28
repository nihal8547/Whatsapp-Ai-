#!/bin/bash
for container in evolution_postgres automation_qa_postgres ares-erp-postgres-1 adam-attendance-final_postgres_1 n8n-postgres-1
do
    echo "Checking container: $container"
    docker exec -i $container psql -U postgres -c "\dt wa_messages" 2>/dev/null || docker exec -i $container psql -U n8n -c "\dt wa_messages" 2>/dev/null || docker exec -i $container psql -U root -c "\dt wa_messages" 2>/dev/null
done
