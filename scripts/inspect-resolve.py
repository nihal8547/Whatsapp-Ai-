import sqlite3
import json

con = sqlite3.connect('/opt/n8n/data/database.sqlite')
row = con.cursor().execute("SELECT nodes FROM workflow_entity WHERE id = 'LN1zL3HaG5JLmEHJ'").fetchone()
nodes = json.loads(row[0])

for n in nodes:
    if n.get("name") == "Resolve Tenant and Save Message":
        print(n.get("parameters", {}).get("query", ""))
