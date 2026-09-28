INSERT INTO wa_contacts (tenant_id, phone, name, last_message_at, needs_human, summary) VALUES (1, '+97412345678', 'Test Customer', now(), true, 'Testing the bot');
INSERT INTO wa_messages (tenant_id, phone, direction, sender, content) VALUES 
(1, '+97412345678', 'inbound', 'Customer', 'Hello AI, how are you?'), 
(1, '+97412345678', 'outbound', 'AI', 'Hello! I am doing great, how can I help you today?');
