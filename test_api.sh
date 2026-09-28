#!/bin/bash
export SESSION_SECRET="a21764c24ff36691c28c899a77d56e6d1e57cdebf457b9e07584ec66c7e140d3"
export DATABASE_URL="postgresql://n8n:SecureN8N_PgsP%40ss!9182@n8n-postgres-1:5432/automation_db"
node -e "
const { SignJWT } = require('jose');
const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
new SignJWT({ userId: 1, tenantId: 1, email: 'admin@webbea.qa', name: 'Admin', role: 'owner', superAdmin: true })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('30d')
  .sign(secret)
  .then(token => {
    require('http').get('http://127.0.0.1:3000/api/chats', {
      headers: { 'Cookie': 'wa_session=' + token }
    }, (res) => {
      console.log('STATUS:', res.statusCode);
      res.on('data', d => process.stdout.write(d));
    }).on('error', console.error);
  });
"
