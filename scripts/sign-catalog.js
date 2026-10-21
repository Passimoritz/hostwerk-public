'use strict';
/*
 * Signs catalog files (Ed25519) so Hostwerk can tell them apart from files planted by someone who took over the GitHub
 * account: writes <file>.sig next to each file. Same format as Hostwerk's server/core/signature.js:
 *
 *   {"v":1,"alg":"ed25519","key":"<key id>","sig":"<base64>","signed":"<iso>"}
 *
 * The signature covers the file bytes with LF line endings (CRLF → LF). The private key comes from the secret
 * HOSTWERK_SIGNING_KEY (PEM, PKCS#8) – it is never stored in this repository. Without the secret the files stay unsigned
 * (a warning in the workflow log); Hostwerk accepts that only during the transition period.
 *
 *   node scripts/sign-catalog.js catalog/extensions.json catalog/community.json
 */
const fs = require('fs');
const crypto = require('crypto');

const files = process.argv.slice(2);
const pem = String(process.env.HOSTWERK_SIGNING_KEY || '').trim();
if (!pem) {
  console.log('::warning::HOSTWERK_SIGNING_KEY is not set – catalog files stay unsigned.');
  process.exit(0);
}
const key = /BEGIN/.test(pem) ? crypto.createPrivateKey(pem) : crypto.createPrivateKey({ key: Buffer.from(pem, 'base64'), format: 'der', type: 'pkcs8' });
if (key.asymmetricKeyType !== 'ed25519') { console.error('HOSTWERK_SIGNING_KEY is not an Ed25519 key.'); process.exit(1); }
const jwk = crypto.createPublicKey(key).export({ format: 'jwk' });
const raw = Buffer.from(jwk.x.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const keyId = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
for (const f of files) {
  if (!fs.existsSync(f)) { console.log(`skipped (missing): ${f}`); continue; }
  const data = Buffer.from(fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n'), 'utf8');
  const sig = crypto.sign(null, data, key).toString('base64');
  fs.writeFileSync(`${f}.sig`, JSON.stringify({ v: 1, alg: 'ed25519', key: keyId, sig, signed: new Date().toISOString() }) + '\n');
  console.log(`signed ${f} (key ${keyId})`);
}
