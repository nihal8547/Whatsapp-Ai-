import sqlite3
import json

con = sqlite3.connect('/opt/n8n/data/database.sqlite')
row = con.cursor().execute("SELECT connections, nodes FROM workflow_entity WHERE id = 'LN1zL3HaG5JLmEHJ'").fetchone()
connections = json.loads(row[0])
nodes = json.loads(row[1])

print('=== TOOLS CONNECTED TO AGENT ===')
connected_tools = []
for src_node, targets in connections.items():
    if 'ai_tool' in targets:
        for branch in targets['ai_tool']:
            for t in branch:
                if t.get('node') == 'WhatsApp AI Agent':
                    connected_tools.append(src_node)
                    print('Tool:', src_node)

for n in nodes:
    if n.get('name') == 'WhatsApp AI Agent':
        print('=== AGENT NODE DETAILS ===')
        print('Agent type:', n.get('type'))
        print('Parameters:', json.dumps(n.get('parameters', {}), indent=2)[:500])

for n in nodes:
    if n.get('name') in ['book_appointment', 'check_availability', 'create_order']:
        print(f"Node {n.get('name')} position:", n.get('position'))
