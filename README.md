# llvadLogin CRM

Shortened admin CRM for **llvadLogin** (TR + EN UI). Brand mark is the gold monogram only (`public/logo-icon-gold.png` / favicon).

## Features
- `/login` — httpOnly session cookie (Secure on HTTPS)
- `/` — overview (seats, licenses, customers, Desktop admin mirror)
- `/licenses` — issue offline HMAC keys compatible with desktop `electron/core/license.ts`
- `/customers` — CRUD in `DATA_DIR/crm.json`
- `GET /health` → `{ "ok": true }`

## License keys
Default `LICENSE_SECRET` matches desktop: `llvadlog-2026-offline-hmac-v1-seller-key`

- Personal: `LLVAD-1-YYYYMMDD-` + HMAC-SHA256(`1|YYYYMMDD`) hex[:16] upper
- Team: `LLVAD-2-{seats}-YYYYMMDD-` + HMAC-SHA256(`2|{seats}|YYYYMMDD`) hex[:16] upper

## Local
```bash
npm install
export ADMIN_USERNAME=llvad
export ADMIN_PASSWORD_HASH_B64='CBs2Kozm/MzCvM8N0d56/S0t04mFVMwaudi/BLjOB1w='
export ADMIN_PASSWORD_SALT_B64='Z5P4uJQvKz0anh9ZuDSTEw=='
export SESSION_SECRET=dev-secret
node server.js
```
Seeded admin user: **llvad** (password not printed; use the scrypt hash above).

## Docker
```bash
docker build -t llvadlogin-crm .
docker run -p 3000:3000 -e PORT=3000 -e ADMIN_USERNAME=llvad \
  -e ADMIN_PASSWORD_HASH_B64='CBs2Kozm/MzCvM8N0d56/S0t04mFVMwaudi/BLjOB1w=' \
  -e ADMIN_PASSWORD_SALT_B64='Z5P4uJQvKz0anh9ZuDSTEw==' \
  -e SESSION_SECRET=change-me -v crmdata:/data llvadlogin-crm
```

## Hosting notes
- **Netlify** site `llvadlogin-crm` (id `2ffafd5d-5b2b-4c95-865a-4b917699aba4`) created; production deploys currently blocked by **Netlify free-plan credit exhaustion**.
- **Railway** free-plan resource provision limit blocks new services/projects; GitHub repo is ready to connect.
- Repo: https://github.com/timurkaanalcin/llvadlogin-crm

## DNS for `crm.llvad.login.org.tr`

`login.org.tr` may not resolve yet. After the host is live:

### If Netlify (`llvadlogin-crm.netlify.app`)
1. Netlify → Domain management → Add domain alias `crm.llvad.login.org.tr`
2. At DNS for `login.org.tr` (or the zone that owns `llvad.login.org.tr`):
   - **Type:** CNAME
   - **Host:** `crm.llvad` (panel-dependent; some want FQDN)
   - **Target:** `llvadlogin-crm.netlify.app`
3. Add any TXT verification Netlify shows; wait for TLS.

### If Railway (`*.up.railway.app`)
1. Railway → service → Settings → Networking → Custom domain `crm.llvad.login.org.tr`
2. Create the CNAME (or ALIAS) Railway returns (often pointing at `*.up.railway.app` or a railway-provided host).
3. Wait for certificate.

Until DNS works, use the platform `*.netlify.app` / `*.up.railway.app` URL.

## Env
| Name | Purpose |
|------|---------|
| `ADMIN_USERNAME` | default `llvad` |
| `ADMIN_PASSWORD_HASH_B64` | scrypt hash N=16384 r=8 p=1 dkLen=32 |
| `ADMIN_PASSWORD_SALT_B64` | scrypt salt |
| `SESSION_SECRET` | session signing |
| `FORCE_SECURE_COOKIE` | `1` on HTTPS |
| `PORT` | default 3000 |
| `DATA_DIR` | JSON store (default `./data`) |
| `LICENSE_SECRET` | keep in sync with desktop |
