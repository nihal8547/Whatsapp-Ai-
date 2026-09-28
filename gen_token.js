const { SignJWT } = require('jose');

const session = {
  userId: 1,
  tenantId: 1,
  email: 'admin@webbea.qa',
  name: 'Admin',
  role: 'owner',
  superAdmin: true,
};

const secret = new TextEncoder().encode(process.env.SESSION_SECRET || "change-me-in-env");

new SignJWT(session)
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('30d')
  .sign(secret)
  .then(token => console.log('TOKEN=' + token));
