'use strict';

const fs = require('fs');
const path = require('path');

// Vercel serverless: persist under /tmp (ephemeral across instances)
const dataDir = process.env.DATA_DIR || '/tmp/llvadlogin-crm-data';
try {
  fs.mkdirSync(dataDir, { recursive: true });
} catch (_) {}
process.env.DATA_DIR = dataDir;
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { app } = require(path.join(__dirname, '..', 'server.js'));
module.exports = app;
