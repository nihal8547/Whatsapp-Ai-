import sqlite3
import json

con = sqlite3.connect('/opt/n8n/data/database.sqlite')
row = con.cursor().execute("SELECT connections, nodes FROM workflow_entity WHERE id = 'LN1zL3HaG5JLmEHJ'").fetchone()
connections = json.loads(row[0])
nodes = json.loads(row[1])

print("=== INCOMING CONNECTIONS TO WhatsApp AI Agent ===")
for src_node, targets in connections.items():
    if "main" in targets:
        for branch in targets["main"]:
            for t in branch:
                if t.get("node") == "WhatsApp AI Agent":
                    print(f"Main input from: {src_node}")

for n in nodes:
    if n.get("name") in ["Resolve Tenant and Save Message", "Build Context", "Prepare Prompt"]:
        print(f"\n--- Node: {n.get('name')} ---")
        if "query" in n.get("parameters", {}):
            print(n.get("parameters", {})["query"][:600])
        elif "jsCode" in n.get("parameters", {}):
            print(n.get("parameters", {})["jsCode"][:600])
