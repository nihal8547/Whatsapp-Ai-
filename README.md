# Webbea WhatsApp Desk — SaaS dashboard

Multi-tenant dashboard for the WhatsApp AI assistant that runs on n8n + Evolution API.
Each business gets its own workspace, its own WhatsApp number, its own assistant
settings, services, appointments and team.

Built with Next.js 15 (App Router, React 19), PostgreSQL and Docker.

---

## What it does

| Page | For |
|---|---|
| **Today** | What happened today, who is waiting for a person, next appointments |
| **Chats** | Live inbox. Read every conversation, take over from the assistant, reply |
| **Appointments** | Everything the assistant booked, plus manual entries. Cancel or complete |
| **Contacts** | Everyone who has messaged, with what the assistant remembers about them |
| **Services & hours** | What can be booked and when. The assistant only offers these |
| **Assistant** | Persona, facts it may state, reminder wording, pause switch |
| **WhatsApp number** | QR linking, connection status, disconnect |
| **Team** | Staff and admin logins for the workspace |
| **All workspaces** | Platform admin only: every tenant, usage, plan and status |

---

## How it fits together

```
Customer WhatsApp
      │
      ▼
Evolution API ──webhook──► n8n (SaaS workflow) ──► PostgreSQL (wa_* tables)
                                 ▲                        ▲
                                 │ platform API           │ reads
                                 │                        │
                          This dashboard ─────────────────┘
```

The dashboard reads PostgreSQL directly and **never** talks to Evolution itself.
Anything that sends a WhatsApp message or links a number goes through the n8n
platform API, so credentials stay on the server.

---

## Requirements

- The n8n SaaS workflow already deployed, with its Platform API webhook live
- PostgreSQL reachable from wherever you run this
- Docker (recommended) or Node 22+

---

## Setup

### 1. Clone and configure

```bash
git clone https://github.com/nihal8547/Whatsapp-Ai-.git
cd Whatsapp-Ai-
cp .env.example .env
```

Fill in `.env`:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
DATABASE_SSL=false
SESSION_SECRET=<a long random string>
N8N_API_URL=https://n8n.example.com/webhook/saas-api
N8N_API_KEY=<your platform api key>
```

Generate a session secret:

```bash
openssl rand -hex 32
```

### 2. Run the migration

Adds the login table and a couple of indexes. Safe to run again.

```bash
psql "$DATABASE_URL" -f migrations/001_dashboard.sql
```

### 3. Start it

```bash
docker compose up -d --build
```

Runs on port 3000. Put it behind your reverse proxy with TLS.

### 4. Create the first login

Existing tenant (for example tenant 1):

```bash
docker compose exec dashboard node scripts/create-user.mjs \
  you@example.com "Your Name" yourpassword --tenant 1
```

Platform admin, who sees every workspace:

```bash
docker compose exec dashboard node scripts/create-user.mjs \
  admin@example.com "Platform Admin" yourpassword --super
```

New businesses sign themselves up at `/signup`; no script needed.

---

## Local development

```bash
npm install
cp .env.example .env    # fill it in
npm run dev
```

---

## Reverse proxy

Nginx:

```nginx
server {
  server_name app.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Caddy:

```
app.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

TLS matters — the login cookie is marked `secure` in production and will not
survive plain HTTP.

---

## Roles

| Role | Can do |
|---|---|
| `owner` | Everything in the workspace, including team and billing settings |
| `admin` | Everything except removing the owner |
| `staff` | Read chats, reply, take over, manage appointments. Settings are read-only |
| super admin | Every workspace, plans and account status |

---

## Where data lives

The dashboard uses the same tables as the n8n workflow, all scoped by `tenant_id`:

`wa_tenants`, `wa_plans`, `wa_instances`, `wa_bot_settings`, `wa_contacts`,
`wa_messages`, `wa_user_memory`, `wa_services`, `wa_business_hours`,
`wa_appointments`, `wa_usage_daily`, `wa_tenant_users`.

---

## Security notes

- `N8N_API_KEY` is read on the server only. It is never sent to the browser.
- Passwords are bcrypt hashed. Sessions are signed JWTs in an httpOnly cookie.
- Every query filters on `tenant_id` taken from the session, not from the request
  body, so one workspace cannot read another's chats.
- Rotate `SESSION_SECRET` to sign everyone out at once.

---

## Troubleshooting

**"Connect your WhatsApp number first" when sending**
The workspace has no linked number, or its Evolution instance dropped. Open
**WhatsApp number** and scan again.

**QR says the server key can't create numbers**
Evolution needs its *global* API key (`AUTHENTICATION_API_KEY`) for
`instance/create`, not an instance token. Update the key in the n8n credential.

**Chats load but nothing sends**
Check `N8N_API_URL` and `N8N_API_KEY`, and that the SaaS workflow is published.

**Login works then bounces back**
Usually a missing or changed `SESSION_SECRET`, or running over plain HTTP in
production.
