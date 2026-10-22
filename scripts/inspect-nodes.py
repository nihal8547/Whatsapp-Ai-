import sqlite3
import json

con = sqlite3.connect('/opt/n8n/data/database.sqlite')
row = con.cursor().execute("SELECT nodes FROM workflow_entity WHERE id = 'LN1zL3HaG5JLmEHJ'").fetchone()
nodes = json.loads(row[0])

for n in nodes:
    if "Resolve" in n.get("name") or "Tenant" in n.get("name") or "Prompt" in n.get("name") or "Build" in n.get("name"):
        print(f"Node: {n.get('name')}, type: {n.get('type')}")
        if "query" in n.get("parameters", {}):
            print("Query:", n.get("parameters", {}).get("query")[:300])
