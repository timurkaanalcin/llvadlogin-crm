# llvadLogin CRM

Shortened admin CRM for **llvadLogin** (Turkish + English UI). Monogram-only brand mark: `public/logo-icon-gold.png`.

## Features
- `/login` — session cookie auth (httpOnly; secure on HTTPS)
- `/` — overview cards (seats, licenses, customers, Desktop admin mirror)
- `/licenses` — issue HMAC license keys compatible with desktop `electron/core/license.ts`
- `/customers` — CRUD stored in `/data/crm.json` (or `DATA_DIR`)
- `GET /health` → `{ "ok": true }`

## License key algorithm
Same offline HMAC as desktop (`LICENSE_SECRET` default `llvadlog-2026-offline-hmac-v1-seller-key`):

- Personal: `LLVAD-1-YYYYMMDD-` + HMAC-SHA256(`1|YYYYMMDD`) hex[:16] upper
- Team: `LLVAD-2-{seats}-YYYYMMDD-` + HMAC-SHA256(`2|{seats}|YYYYMMDD`) hex[:16] upper

## Local run
```bash
npm install
export ADMIN_USERNAME=llvad
export ADMIN_PASSWORD_HASH_B64='CBs2Kozm/MzCvM8N0d56/S0t04mFVMwaudi/BLjOB1w='
export ADMIN_PASSWORD_SALT_B64='Z5P4uJQvKz0anh9ZuDSTEw=='
export SESSION_SECRET='change-me'
node server.js
```
Open http://localhost:3000 — seeded admin user **llvad**.

## Docker / Railway
```bash
docker build -t llvadlogin-crm .
docker run -p 3000:3000 -e PORT=3000 -e ADMIN_USERNAME=llvad \
  -e ADMIN_PASSWORD_HASH_B64='CBs2Kozm/MzCvM8N0d56/S0t04mFVMwaudi/BLjOB1w=' \
  -e ADMIN_PASSWORD_SALT_B64='Z5P4uJQvKz0anh9ZuDSTEw==' \
  -e SESSION_SECRET=change-me -v crmdata:/data llvadlogin-crm
```

## DNS for `crm.llvad.login.org.tr`

`login.org.tr` may not resolve yet. After attaching the custom domain in Netlify (Domain management → Add domain alias `crm.llvad.login.org.tr`):

1. Create DNS at the `login.org.tr` zone (or parent that owns `llvad.login.org.tr`):
   - **Type:** `CNAME`
   - **Host / Name:** `crm.llvad` (exact label depends on DNS panel — some want `crm.llvad.login.org.tr`)
   - **Value / Target:** `singular-salamander-fbcb55.netlify.app` (or the renamed `llvadlogin-crm.netlify.app` hostname shown in Netlify)
2. If Netlify shows a **NETLIFY** / verification **TXT** record, add it as instructed.
3. Wait for DNS propagation + TLS certificate issuance.

Until DNS works, use the Netlify `*.netlify.app` URL.

## Env vars
| Name | Purpose |
|------|---------|
| `ADMIN_USERNAME` | Admin login (default `llvad`) |
| `ADMIN_PASSWORD_HASH` / `ADMIN_PASSWORD_HASH_B64` | scrypt hash (base64), N=16384 r=8 p=1 dkLen=32 |
| `ADMIN_PASSWORD_SALT_B64` | scrypt salt (default seeded) |
| `SESSION_SECRET` | Express session secret |
| `PORT` | Listen port (default 3000) |
| `DATA_DIR` | JSON store directory (default `./data` or `/data` in Docker) |
| `LICENSE_SECRET` | Override HMAC seller secret (keep in sync with desktop) |

Never commit plaintext passwords.
