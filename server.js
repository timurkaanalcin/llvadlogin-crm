'use strict';

/**
 * llvadLogin CRM — shortened admin console
 * License keys use the same offline HMAC as desktop electron/core/license.ts
 * secret: llvadlog-2026-offline-hmac-v1-seller-key
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'crm.json');
const LICENSE_SECRET = process.env.LICENSE_SECRET || 'llvadlog-2026-offline-hmac-v1-seller-key';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'llvad';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// scrypt params from seed (salt_b64 / hash_b64)
const SCRYPT = {
  N: 16384,
  r: 8,
  p: 1,
  dkLen: 32,
  salt: Buffer.from(process.env.ADMIN_PASSWORD_SALT_B64 || 'Z5P4uJQvKz0anh9ZuDSTEw==', 'base64'),
  hash: Buffer.from(
    process.env.ADMIN_PASSWORD_HASH_B64 ||
      process.env.ADMIN_PASSWORD_HASH ||
      'CBs2Kozm/MzCvM8N0d56/S0t04mFVMwaudi/BLjOB1w=',
    'base64'
  ),
};

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      customers: [],
      licenses: [],
      meta: { createdAt: new Date().toISOString(), brand: 'llvadLogin CRM' },
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
  }
}

function readStore() {
  ensureData();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeStore(store) {
  ensureData();
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

function hmac(payload) {
  return crypto
    .createHmac('sha256', LICENSE_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
}

/** Same algorithm as desktop generateLicenseKey */
function generateLicenseKey(expiryYmd, seats = 1) {
  const ymd = String(expiryYmd).replace(/-/g, '').slice(0, 8);
  if (!/^\d{8}$/.test(ymd)) throw new Error('expiry must be YYYYMMDD or YYYY-MM-DD');
  const n = Math.max(1, Math.min(99, Number(seats) || 1));
  if (n === 1) return `LLVAD-1-${ymd}-${hmac(`1|${ymd}`)}`;
  return `LLVAD-2-${n}-${ymd}-${hmac(`2|${n}|${ymd}`)}`;
}

function verifyPassword(password) {
  return new Promise((resolve, reject) => {
    // Prefer hash; allow plaintext ADMIN_PASSWORD only if hash not set (local/dev)
    if (process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH && !process.env.ADMIN_PASSWORD_HASH_B64) {
      const a = Buffer.from(String(password));
      const b = Buffer.from(String(process.env.ADMIN_PASSWORD));
      if (a.length !== b.length) return resolve(false);
      return resolve(crypto.timingSafeEqual(a, b));
    }
    crypto.scrypt(String(password), SCRYPT.salt, SCRYPT.dkLen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (err, derived) => {
      if (err) return reject(err);
      try {
        resolve(crypto.timingSafeEqual(derived, SCRYPT.hash));
      } catch {
        resolve(false);
      }
    });
  });
}

function uid() {
  return crypto.randomBytes(8).toString('hex');
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout({ title, user, body, flash }) {
  const nav = user
    ? `<nav class="nav">
        <a href="/" class="brand"><img src="/logo-icon-gold.png" alt="" class="brand-mark" width="28" height="28" /><span class="brand-text">llvadLogin <span>CRM</span></span></a>
        <div class="links">
          <a href="/">Overview / Genel</a>
          <a href="/licenses">Licenses / Lisanslar</a>
          <a href="/customers">Customers / Müşteriler</a>
          <form method="post" action="/logout" class="inline"><button type="submit" class="btn ghost">Logout / Çıkış</button></form>
        </div>
      </nav>`
    : `<nav class="nav"><a href="/login" class="brand"><img src="/logo-icon-gold.png" alt="" class="brand-mark" width="28" height="28" /><span class="brand-text">llvadLogin <span>CRM</span></span></a></nav>`;

  const flashHtml = flash
    ? `<div class="flash ${flash.type || 'info'}">${escapeHtml(flash.message)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · llvadLogin CRM</title>
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/logo-icon-gold.png" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  ${nav}
  <main class="container">
    ${flashHtml}
    ${body}
  </main>
  <footer class="footer">
    <span>llvadLogin CRM</span>
    <span class="muted">Desktop admin mirror · Masaüstü admin aynası</span>
  </footer>
</body>
</html>`;
}

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect('/login');
}

function createApp() {
  ensureData();
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(
    cookieSession({
      name: 'llvadlogin_crm_sid',
      keys: [SESSION_SECRET],
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' || process.env.FORCE_SECURE_COOKIE === '1',
    })
  );
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    const err = req.query.error ? { type: 'error', message: String(req.query.error) } : null;
    res.send(
      layout({
        title: 'Login / Giriş',
        user: null,
        flash: err,
        body: `
      <section class="card login-card">
        <div class="login-hero"><img src="/logo-icon-gold.png" alt="llvadLogin" width="56" height="56" /></div>
        <h1>Admin Login / Yönetici Girişi</h1>
        <p class="muted">llvadLogin CRM — short admin console</p>
        <form method="post" action="/login" class="form">
          <label>Username / Kullanıcı adı
            <input name="username" autocomplete="username" required autofocus />
          </label>
          <label>Password / Şifre
            <input name="password" type="password" autocomplete="current-password" required />
          </label>
          <button class="btn primary" type="submit">Sign in / Giriş yap</button>
        </form>
      </section>`,
      })
    );
  });

  app.post('/login', async (req, res) => {
    try {
      const username = String(req.body.username || '').trim();
      const password = String(req.body.password || '');
      if (username !== ADMIN_USERNAME || !(await verifyPassword(password))) {
        return res.redirect('/login?error=' + encodeURIComponent('Invalid credentials / Geçersiz kimlik bilgileri'));
      }
      req.session.user = { username };
      res.redirect('/');
    } catch (e) {
      console.error(e);
      res.redirect('/login?error=' + encodeURIComponent('Auth error / Kimlik doğrulama hatası'));
    }
  });

  app.post('/logout', (req, res) => {
    req.session = null;
    res.clearCookie('llvadlogin_crm_sid');
    res.redirect('/login');
  });

  app.get('/', requireAuth, (req, res) => {
    const store = readStore();
    const seats = store.customers.reduce((n, c) => n + (Number(c.seats) || 0), 0);
    res.send(
      layout({
        title: 'Overview / Genel Bakış',
        user: req.session.user,
        body: `
      <header class="page-head">
        <h1>Overview / Genel Bakış</h1>
        <p class="muted">Desktop admin mirror · Masaüstü admin aynası</p>
      </header>
      <div class="grid cards">
        <article class="card metric"><div class="label">Seats / Koltuklar</div><div class="value">${seats}</div></article>
        <article class="card metric"><div class="label">Licenses / Lisanslar</div><div class="value">${store.licenses.length}</div><a href="/licenses">Manage →</a></article>
        <article class="card metric"><div class="label">Customers / Müşteriler</div><div class="value">${store.customers.length}</div><a href="/customers">Manage →</a></article>
        <article class="card metric stub"><div class="label">Desktop admin mirror</div><div class="value small">llvadLogin</div><p class="muted">Offline HMAC license seller console</p></article>
      </div>`,
      })
    );
  });

  app.get('/licenses', requireAuth, (req, res) => {
    const store = readStore();
    const rows = store.licenses
      .slice()
      .reverse()
      .map(
        (l) => `<tr>
        <td><code>${escapeHtml(l.key)}</code></td>
        <td>${escapeHtml(l.seats)}</td>
        <td>${escapeHtml(l.expires)}</td>
        <td>${escapeHtml(l.note || '')}</td>
        <td>${escapeHtml(l.createdAt || '')}</td>
        <td>
          <form method="post" action="/licenses/${escapeHtml(l.id)}/delete" onsubmit="return confirm('Delete? / Silinsin mi?')">
            <button class="btn danger sm" type="submit">Delete / Sil</button>
          </form>
        </td>
      </tr>`
      )
      .join('');

    res.send(
      layout({
        title: 'Licenses / Lisanslar',
        user: req.session.user,
        flash: req.query.ok
          ? { type: 'ok', message: 'License issued / Lisans oluşturuldu: ' + String(req.query.ok) }
          : null,
        body: `
      <header class="page-head">
        <h1>Licenses / Lisanslar</h1>
        <p class="muted">HMAC-compatible with desktop offline validator (secret documented in README). Desktop uses offline HMAC — CRM generates matching keys.</p>
      </header>
      <section class="card">
        <h2>Issue key / Anahtar oluştur</h2>
        <form method="post" action="/licenses" class="form row">
          <label>Expiry / Bitiş (YYYY-MM-DD)
            <input name="expires" type="date" required />
          </label>
          <label>Seats / Koltuk
            <input name="seats" type="number" min="1" max="99" value="1" required />
          </label>
          <label>Note / Not
            <input name="note" placeholder="customer / plan" />
          </label>
          <button class="btn primary" type="submit">Generate / Oluştur</button>
        </form>
      </section>
      <section class="card table-wrap">
        <table>
          <thead><tr><th>Key</th><th>Seats</th><th>Expires</th><th>Note</th><th>Created</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="muted">No licenses yet / Henüz lisans yok</td></tr>'}</tbody>
        </table>
      </section>`,
      })
    );
  });

  app.post('/licenses', requireAuth, (req, res) => {
    try {
      const expires = String(req.body.expires || '');
      const seats = Number(req.body.seats) || 1;
      const note = String(req.body.note || '').slice(0, 200);
      const key = generateLicenseKey(expires, seats);
      const store = readStore();
      store.licenses.push({
        id: uid(),
        key,
        seats,
        expires,
        note,
        createdAt: new Date().toISOString(),
      });
      writeStore(store);
      res.redirect('/licenses?ok=' + encodeURIComponent(key));
    } catch (e) {
      res.redirect('/licenses?error=' + encodeURIComponent(e.message || 'error'));
    }
  });

  app.post('/licenses/:id/delete', requireAuth, (req, res) => {
    const store = readStore();
    store.licenses = store.licenses.filter((l) => l.id !== req.params.id);
    writeStore(store);
    res.redirect('/licenses');
  });

  app.get('/customers', requireAuth, (req, res) => {
    const store = readStore();
    const rows = store.customers
      .map(
        (c) => `<tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.email)}</td>
        <td>${escapeHtml(c.plan)}</td>
        <td>${escapeHtml(c.seats)}</td>
        <td>${escapeHtml(c.notes || '')}</td>
        <td class="actions">
          <form method="post" action="/customers/${escapeHtml(c.id)}/delete" onsubmit="return confirm('Delete customer? / Müşteri silinsin mi?')">
            <button class="btn danger sm" type="submit">Delete / Sil</button>
          </form>
        </td>
      </tr>`
      )
      .join('');

    res.send(
      layout({
        title: 'Customers / Müşteriler',
        user: req.session.user,
        body: `
      <header class="page-head">
        <h1>Customers / Müşteriler</h1>
        <p class="muted">Stored in /data/crm.json</p>
      </header>
      <section class="card">
        <h2>Add customer / Müşteri ekle</h2>
        <form method="post" action="/customers" class="form row">
          <label>Name / Ad<input name="name" required /></label>
          <label>Email<input name="email" type="email" required /></label>
          <label>Plan
            <select name="plan">
              <option value="trial">trial</option>
              <option value="personal">personal</option>
              <option value="team">team</option>
              <option value="enterprise">enterprise</option>
            </select>
          </label>
          <label>Seats / Koltuk<input name="seats" type="number" min="1" max="99" value="1" /></label>
          <label>Notes / Notlar<input name="notes" /></label>
          <button class="btn primary" type="submit">Save / Kaydet</button>
        </form>
      </section>
      <section class="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Plan</th><th>Seats</th><th>Notes</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="muted">No customers / Müşteri yok</td></tr>'}</tbody>
        </table>
      </section>`,
      })
    );
  });

  app.post('/customers', requireAuth, (req, res) => {
    const store = readStore();
    store.customers.push({
      id: uid(),
      name: String(req.body.name || '').slice(0, 120),
      email: String(req.body.email || '').slice(0, 160),
      plan: String(req.body.plan || 'trial').slice(0, 40),
      seats: Math.max(1, Math.min(99, Number(req.body.seats) || 1)),
      notes: String(req.body.notes || '').slice(0, 500),
      createdAt: new Date().toISOString(),
    });
    writeStore(store);
    res.redirect('/customers');
  });

  app.post('/customers/:id/delete', requireAuth, (req, res) => {
    const store = readStore();
    store.customers = store.customers.filter((c) => c.id !== req.params.id);
    writeStore(store);
    res.redirect('/customers');
  });

  return app;
}

const app = createApp();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`llvadLogin CRM listening on :${PORT}`);
  });
}

module.exports = { app, createApp, generateLicenseKey, verifyPassword };
