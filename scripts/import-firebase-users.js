/**
 * One-time importer for Cosenza Firebase Authentication users.
 *
 * Run locally, never in GitHub Actions or the browser:
 *   npm install firebase-admin
 *   GOOGLE_APPLICATION_CREDENTIALS="/path/outside/repo/service-account.json" node scripts/import-firebase-users.js
 *
 * The service-account file must never be committed or shared.
 */
const fs = require('node:fs');
const path = require('node:path');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const projectId = 'cosenza-app';
const credentialsPath = path.resolve(__dirname, '..', 'login_credentials.local.json');
const source = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Manca GOOGLE_APPLICATION_CREDENTIALS: indica il percorso locale del service-account JSON.');
  process.exit(1);
}
if (!Array.isArray(source.users) || source.users.length === 0) {
  console.error('login_credentials.local.json non contiene una lista users valida.');
  process.exit(1);
}

const emailFor = username => {
  const key = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{1,40}$/.test(key)) throw new Error('Nome utente non supportato: ' + username);
  return key + '@cosenza-app.firebaseapp.com';
};

// Validate the complete file before creating any account.
const seen = new Set();
for (const user of source.users) {
  const email = emailFor(user.username);
  if (seen.has(email)) throw new Error('Collisione tra nomi utente: ' + user.username);
  seen.add(email);
  if (typeof user.password !== 'string' || user.password.length < 6) {
    throw new Error('La password per ' + user.username + ' non soddisfa il minimo Firebase di 6 caratteri. Nessun account è stato creato.');
  }
}

initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();

(async () => {
  let created = 0;
  let skipped = 0;
  for (const user of source.users) {
    const email = emailFor(user.username);
    try {
      await auth.getUserByEmail(email);
      console.log('Gia esistente, non modificato:', user.username);
      skipped++;
      continue;
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
    }
    await auth.createUser({
      email,
      password: user.password,
      displayName: user.username,
      emailVerified: false,
      disabled: false
    });
    console.log('Creato account Firebase:', user.username);
    created++;
  }
  console.log(`Completato. Creati: ${created}; gia esistenti e lasciati invariati: ${skipped}.`);
  console.log('Gli account gia esistenti non vengono reimpostati automaticamente.');
})().catch(error => {
  console.error('Import interrotto:', error.message || error);
  process.exitCode = 1;
});
