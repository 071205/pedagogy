import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const IDENTITY = Object.freeze({
  projectId: 'pedagogy-ai-staging', projectNumber: '450368559700',
  appId: '1:450368559700:web:5e8f86074f042dd7d12bc1',
  authDomain: 'pedagogy-ai-staging.firebaseapp.com',
  storageBucket: 'pedagogy-ai-staging.firebasestorage.app',
});
export const ORIGIN = 'http://localhost:8796';
export const PRODUCTION = /pedagogy-huryul|297266134873|dawn-shape-2664|AIzaSyAaQHf_Um-eg7SReuJYgS517XfGmlmGJ3Y/;

export function validateConfiguration(value) {
  if (!value || Object.keys(value).sort().join(',') !== 'appCheckSiteKey,firebase,kind,origin')
    throw Error('Staging configuration fields mismatch');
  if (value.kind !== 'backend-staging-a0' || value.origin !== ORIGIN)
    throw Error('Staging kind/origin mismatch');
  const f = value.firebase;
  const keys = ['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId'].sort();
  if (!f || Object.keys(f).sort().join(',') !== keys.join(',')) throw Error('Firebase configuration fields mismatch');
  for (const key of ['projectId','appId','authDomain','storageBucket'])
    if (f[key] !== IDENTITY[key]) throw Error('Staging identity mismatch: ' + key);
  if (f.messagingSenderId !== IDENTITY.projectNumber) throw Error('Staging project number mismatch');
  if (!/^AIza[A-Za-z0-9_-]{35}$/.test(f.apiKey) || !/^[A-Za-z0-9_-]{20,200}$/.test(value.appCheckSiteKey))
    throw Error('Staging public key format mismatch');
  if (PRODUCTION.test(JSON.stringify(value))) throw Error('Production identifier in staging configuration');
  return structuredClone(value);
}

// Direct GET avoids management helpers that may activate APIs. Response bodies
// and credentials never become diagnostics. The caller only receives public config.
export async function readConfiguration(accessToken, request = fetch) {
  async function get(url, label) {
    let response;
    try { response = await request(url, { method: 'GET', headers: { Authorization: 'Bearer ' + accessToken }, signal: AbortSignal.timeout(15000) }); }
    catch { throw Error('Staging GET failed: ' + label); }
    if (!response.ok) throw Error('Staging GET refused: ' + label + ' HTTP ' + response.status);
    try { return await response.json(); } catch { throw Error('Staging GET invalid JSON: ' + label); }
  }
  const base = 'https://firebase.googleapis.com/v1beta1/projects/' + IDENTITY.projectId;
  const p = await get(base, 'project identity');
  if (p.projectId !== IDENTITY.projectId || p.projectNumber !== IDENTITY.projectNumber)
    throw Error('Remote staging project identity mismatch');
  const sdk = await get(base + '/webApps/' + IDENTITY.appId + '/config', 'web config');
  const billing = await get('https://cloudbilling.googleapis.com/v1/projects/' + IDENTITY.projectId + '/billingInfo', 'billing state');
  if (billing.billingEnabled !== false) throw Error('A0 requires unlinked billing');
  const appCheck = await get('https://firebaseappcheck.googleapis.com/v1/projects/' + IDENTITY.projectNumber + '/apps/' + IDENTITY.appId + '/recaptchaEnterpriseConfig', 'App Check config');
  if (typeof appCheck.siteKey !== 'string' || !/^[A-Za-z0-9_-]{20,200}$/.test(appCheck.siteKey))
    throw Error('Missing staging Enterprise public key');
  const key = await get('https://recaptchaenterprise.googleapis.com/v1/projects/' + IDENTITY.projectId + '/keys/' + encodeURIComponent(appCheck.siteKey), 'Enterprise domain binding');
  if (key.webSettings?.integrationType !== 'SCORE' || key.webSettings?.allowAllDomains === true
      || JSON.stringify(key.webSettings?.allowedDomains) !== JSON.stringify(['localhost']))
    throw Error('Staging Enterprise domain binding mismatch');
  return validateConfiguration({ kind: 'backend-staging-a0', origin: ORIGIN,
    firebase: { apiKey: sdk.apiKey, authDomain: sdk.authDomain, projectId: sdk.projectId,
      storageBucket: sdk.storageBucket, messagingSenderId: sdk.messagingSenderId, appId: sdk.appId },
    appCheckSiteKey: appCheck.siteKey });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const require = createRequire(import.meta.url);
    const auth = require('firebase-tools/lib/auth.js');
    const fingerprint = a => createHash('sha256').update(a.user.email.toLowerCase()).digest('hex').slice(0,12);
    const account = auth.getAllAccounts().find(a => fingerprint(a) === '74138acea7c7');
    if (!account) throw Error('Expected staging account absent; no default fallback');
    if(typeof account.tokens?.refresh_token!=='string'||!account.tokens.refresh_token)throw Error('No refresh token; no default fallback');
    const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
    const config = await readConfiguration(token.access_token);
    const directory = await mkdtemp(join(tmpdir(), 'pedagogy-a0-config-'));
    await chmod(directory, 0o700);
    const path = join(directory, 'public-config.json');
    await writeFile(path, JSON.stringify(config, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    console.log('Verified A0 public configuration written outside repository: ' + path);
  } catch (error) {
    // Authentication libraries may attach raw responses; never serialize errors.
    console.error('A0 configuration read failed; no build or remote change performed.');
    process.exitCode = 1;
  }
}
