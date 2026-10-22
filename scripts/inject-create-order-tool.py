import sqlite3
import json
import uuid

DB_PATH = "/opt/n8n/data/database.sqlite"
WORKFLOW_ID = "LN1zL3HaG5JLmEHJ"

con = sqlite3.connect(DB_PATH)
cur = con.cursor()

row = cur.execute("SELECT nodes, connections FROM workflow_entity WHERE id = ?", (WORKFLOW_ID,)).fetchone()
if not row:
    print(f"Error: Workflow {WORKFLOW_ID} not found!")
    exit(1)

nodes = json.loads(row[0])
connections = json.loads(row[1])

# 1. Define create_order tool node with full Acceptance Mode support
create_order_sql = """WITH tenant_info AS (
  SELECT t.id,
    COALESCE(NULLIF(t.modules, '[]'::jsonb), bp.modules, '[]'::jsonb) AS mods,
    COALESCE(bs.order_settings, '{}'::jsonb) AS oset
  FROM wa_tenants t
  LEFT JOIN wa_business_packs bp ON bp.code = COALESCE(t.pack_code, t.business_type)
  LEFT JOIN wa_bot_settings bs ON bs.tenant_id = t.id
  WHERE t.id = $1::int
),
mod_check AS (
  SELECT
    (mods ? 'orders') AS enabled,
    COALESCE((oset->>'accepting_orders')::boolean, true) AS accepting,
    COALESCE(oset->>'closed_message', 'We are currently not accepting new orders at this time. Please check back later!') AS closed_msg,
    COALESCE(oset->>'accept_mode', 'manual') AS accept_mode,
    COALESCE((oset->>'prep_minutes')::int, 30) AS prep_minutes,
    COALESCE((oset->>'pickup')::boolean, true) AS allow_pickup,
    COALESCE((oset->>'delivery')::boolean, true) AS allow_delivery,
    COALESCE((oset->>'min_order')::numeric, 0) AS min_order
  FROM tenant_info
),
val_check AS (
  SELECT
    mc.*,
    CASE
      WHEN NOT mc.enabled THEN 'ORDERS_NOT_ENABLED'
      WHEN NOT mc.accepting THEN 'ORDERS_CLOSED'
      WHEN lower(trim(COALESCE($4::text, ''))) = 'pickup' AND NOT mc.allow_pickup THEN 'PICKUP_NOT_ALLOWED'
      WHEN lower(trim(COALESCE($4::text, ''))) <> 'pickup' AND NOT mc.allow_delivery THEN 'DELIVERY_NOT_ALLOWED'
      WHEN mc.min_order > 0 AND COALESCE($6::numeric, 0) < mc.min_order THEN 'BELOW_MIN_ORDER'
      ELSE 'OK'
    END AS check_result
  FROM mod_check mc
),
gen_no AS (
  INSERT INTO wa_order_counters (tenant_id, last_no)
  SELECT $1::int, 1001
  FROM val_check WHERE check_result = 'OK'
  ON CONFLICT (tenant_id) DO UPDATE
    SET last_no = wa_order_counters.last_no + 1
  RETURNING last_no
),
ins_contact AS (
  INSERT INTO wa_contacts (tenant_id, phone, name)
  SELECT $1::int, $2, NULLIF(trim($3::text), '')
  FROM val_check WHERE check_result = 'OK'
  ON CONFLICT (tenant_id, phone) DO UPDATE
    SET name = COALESCE(NULLIF(trim($3::text), ''), wa_contacts.name)
  RETURNING phone
),
ins_order AS (
  INSERT INTO wa_orders (
    tenant_id, phone, order_no, status, fulfilment,
    address_text, customer_name, subtotal, total,
    currency, notes, staff_alerted, placed_at
  )
  SELECT
    $1::int,
    $2,
    (SELECT last_no::text FROM gen_no),
    CASE WHEN vc.accept_mode = 'auto' THEN 'accepted' ELSE 'pending' END,
    CASE WHEN lower(trim(COALESCE($4::text, ''))) = 'pickup' THEN 'pickup' ELSE 'delivery' END,
    NULLIF(trim($5::text), ''),
    NULLIF(trim($3::text), ''),
    COALESCE($6::numeric, 0),
    COALESCE($6::numeric, 0),
    COALESCE((SELECT currency FROM wa_catalog_items WHERE tenant_id = $1::int AND currency IS NOT NULL LIMIT 1), 'QAR'),
    NULLIF(trim(COALESCE($7::text, '') || CASE WHEN $8::text IS NOT NULL AND trim($8::text) <> '' THEN ' | Notes: ' || trim($8::text) ELSE '' END), ''),
    (vc.accept_mode = 'auto'),
    now()
  FROM val_check vc
  WHERE vc.check_result = 'OK'
  RETURNING id, order_no, status, total, currency
),
ins_item AS (
  INSERT INTO wa_order_items (order_id, tenant_id, name, qty, unit_price, line_total, notes)
  SELECT
    o.id,
    $1::int,
    COALESCE(NULLIF(trim($7::text), ''), 'Order items'),
    1,
    COALESCE($6::numeric, 0),
    COALESCE($6::numeric, 0),
    NULLIF(trim($5::text), '')
  FROM ins_order o
  RETURNING id
),
ins_notif AS (
  INSERT INTO wa_notifications (tenant_id, kind, title, body, ref_type, ref_id)
  SELECT
    $1::int,
    'new_order',
    '📦 New Order #' || o.order_no || CASE WHEN o.status = 'accepted' THEN ' (Auto-Accepted)' ELSE '' END,
    'Customer: ' || COALESCE(NULLIF(trim($3::text), ''), $2) || ' (' || $2 || ') placed an order. Total: ' || o.total || ' ' || o.currency || '. Status: ' || o.status || '. Items: ' || COALESCE(NULLIF(trim($7::text), ''), 'N/A') || '. Location: ' || COALESCE(NULLIF(trim($5::text), ''), 'N/A'),
    'order',
    o.id
  FROM ins_order o
  RETURNING id
)
SELECT
  CASE
    WHEN (SELECT check_result FROM val_check) <> 'OK' THEN (SELECT check_result FROM val_check)
    WHEN EXISTS (SELECT 1 FROM ins_order) THEN 'ORDER_CREATED'
    ELSE 'FAILED'
  END AS status,
  (SELECT id FROM ins_order) AS order_id,
  (SELECT order_no FROM ins_order) AS order_no,
  (SELECT status FROM ins_order) AS order_status,
  (SELECT total FROM ins_order) AS total,
  (SELECT currency FROM ins_order) AS currency,
  CASE
    WHEN (SELECT check_result FROM val_check) = 'ORDERS_NOT_ENABLED' THEN 'Orders module is not enabled for this business.'
    WHEN (SELECT check_result FROM val_check) = 'ORDERS_CLOSED' THEN (SELECT closed_msg FROM val_check)
    WHEN (SELECT check_result FROM val_check) = 'PICKUP_NOT_ALLOWED' THEN 'In-store pickup is not available. We only offer delivery.'
    WHEN (SELECT check_result FROM val_check) = 'DELIVERY_NOT_ALLOWED' THEN 'Delivery is not available. We only offer in-store pickup.'
    WHEN (SELECT check_result FROM val_check) = 'BELOW_MIN_ORDER' THEN 'Minimum order amount is ' || (SELECT min_order FROM val_check) || ' QAR.'
    WHEN (SELECT status FROM ins_order) = 'accepted' THEN 'Order #' || (SELECT order_no FROM ins_order) || ' has been automatically ACCEPTED. Estimated preparation time is ' || (SELECT prep_minutes FROM val_check) || ' minutes. Total: ' || (SELECT total FROM ins_order) || ' ' || (SELECT currency FROM ins_order) || '. Team is preparing it now.'
    WHEN EXISTS (SELECT 1 FROM ins_order) THEN 'Order #' || (SELECT order_no FROM ins_order) || ' has been received with status pending. Team will review and confirm shortly.'
    ELSE 'Could not create order in database.'
  END AS reason;"""

query_replacement = '={{ [ $("Resolve Tenant and Save Message").first().json.tenant_id, $("Parse Evolution Message").first().json.phone, $fromAI("customer_name", "Customer full name or empty string if unknown", "string"), $fromAI("fulfilment", "Fulfillment method: delivery or pickup", "string"), $fromAI("address", "Customer delivery address, street, building, or area (or empty string if pickup)", "string"), $fromAI("total_amount", "Total order price as a number, or 0 if not calculated", "number"), $fromAI("items_summary", "Summary of items ordered with quantities and variants/colors (e.g. Winter Drift Bike (Blue) x 1, Winter Drift Bike (Yellow) x 1)", "string"), $fromAI("notes", "Any special delivery instructions or customer notes", "string") ] }}'

tool_node = {
    "parameters": {
        "descriptionType": "manual",
        "operation": "executeQuery",
        "options": {
            "queryReplacement": query_replacement
        },
        "query": create_order_sql,
        "toolDescription": "Create and record a customer order for products/delivery/pickup once customer has specified items, delivery location/address, and confirmed. Automatically applies the business acceptance mode (Auto-Accept or Manual Review), validates minimum order, saves the order into the database, and alerts the staff. Returns status ORDER_CREATED with assigned order_no and reason."
    },
    "type": "n8n-nodes-base.postgresTool",
    "typeVersion": 2.6,
    "position": [5150, 592],
    "id": str(uuid.uuid4()),
    "name": "create_order",
    "credentials": {
        "postgres": {
            "id": "wMTVSxt2sAy26ZXX",
            "name": "Postgres account"
        }
    }
}

# Update create_order node
existing_idx = next((i for i, n in enumerate(nodes) if n.get("name") == "create_order"), None)
if existing_idx is not None:
    print("Updating existing create_order node with acceptance mode query...")
    tool_node["id"] = nodes[existing_idx]["id"]
    nodes[existing_idx] = tool_node
else:
    print("Adding create_order node...")
    nodes.append(tool_node)

connections["create_order"] = {
    "ai_tool": [
        [
            {
                "node": "WhatsApp AI Agent",
                "type": "ai_tool",
                "index": 0
            }
        ]
    ]
}

# Update agent systemMessage
orders_instructions = """## ORDERS & PURCHASES
- CRITICAL: Only take customer orders if "orders" is explicitly listed in "WHAT THIS BUSINESS OFFERS HERE" enabled modules. If "orders" is NOT enabled, say you will check with the team and call request_human.
- When a customer wants to buy, purchase, or order products or items:
  1. Confirm the product/item name, quantity, and variant (e.g. color, size) if applicable.
  2. Ask for their delivery address or area in Qatar (e.g. Doha, Al Rayyan, Al Wakra, etc.), or confirm pickup if they prefer to pick up in store.
  3. Ask for their name if not already known (and call save_customer_name).
  4. Confirm the order summary, total price, and cash on delivery (COD) or payment terms.
  5. When the customer confirms or says yes / ok / sheri / proceed: YOU MUST CALL THE create_order TOOL IMMEDIATELY to save the order into the database.
  6. Explain the outcome based on create_order's response:
     - If create_order returns status ORDER_CREATED with order_status "accepted" (Auto-Accept Mode): Inform the customer that their order #{order_no} has been confirmed and accepted, state the estimated prep/delivery time, and confirm our team is preparing it now.
     - If create_order returns status ORDER_CREATED with order_status "pending" (Manual Review Mode): Inform the customer that their order #{order_no} has been received, and our team will review and confirm it shortly.
     - If create_order returns ORDERS_CLOSED: Politely explain that ordering is currently paused and quote the reason returned.
     - If create_order returns BELOW_MIN_ORDER, PICKUP_NOT_ALLOWED, or DELIVERY_NOT_ALLOWED: Inform the customer politely of the policy.
"""

for n in nodes:
    if n.get("name") == "WhatsApp AI Agent":
        sm = n.get("parameters", {}).get("options", {}).get("systemMessage", "")
        if "## ORDERS & PURCHASES" in sm:
            print("Replacing existing ORDERS & PURCHASES section in agent systemMessage...")
            idx = sm.find("## ORDERS & PURCHASES")
            next_sec = sm.find("## HUMAN HANDOFF", idx)
            if next_sec != -1:
                sm = sm[:idx] + orders_instructions + "\n" + sm[next_sec:]
            else:
                sm = sm[:idx] + orders_instructions
            n["parameters"]["options"]["systemMessage"] = sm
        else:
            print("Appending ORDERS & PURCHASES section into WhatsApp AI Agent systemMessage...")
            sm = sm + "\n\n" + orders_instructions
            n["parameters"]["options"]["systemMessage"] = sm

cur.execute("UPDATE workflow_entity SET nodes = ?, connections = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
            (json.dumps(nodes), json.dumps(connections), WORKFLOW_ID))
con.commit()
con.close()

print("Successfully updated create_order tool and agent with full Acceptance Mode logic!")
