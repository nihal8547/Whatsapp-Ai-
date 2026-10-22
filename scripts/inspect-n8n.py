import sqlite3
import json

con = sqlite3.connect("/opt/n8n/data/database.sqlite")
cur = con.cursor()

nodes_json = cur.execute("SELECT nodes FROM workflow_entity WHERE id = 'LN1zL3HaG5JLmEHJ'").fetchone()
nodes = json.loads(nodes_json[0])

for n in nodes:
    if n.get("name") == "book_appointment":
        print(json.dumps(n, indent=2))
        break
