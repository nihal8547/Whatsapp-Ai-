import sqlite3
import json

con = sqlite3.connect('/opt/n8n/data/database.sqlite')
row = con.cursor().execute("SELECT connections FROM workflow_entity WHERE id = 'LN1zL3HaG5JLmEHJ'").fetchone()
connections = json.loads(row[0])

for k in ["book_appointment", "request_stay", "book_table"]:
    print(k, ":", connections.get(k))
