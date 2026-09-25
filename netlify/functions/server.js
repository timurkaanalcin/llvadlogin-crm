'use strict';
const path = require('path');
const fs = require('fs');
const serverless = require('serverless-http');

const dataDir = process.env.DATA_DIR || '/tmp/llvadlogin-crm-data';
try { fs.mkdirSync(dataDir, { recursive: true }); } catch (_) {}
process.env.DATA_DIR = dataDir;
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

function loadApp() {
  const candidates = [
    path.join(__dirname, '../../server.js'),
    path.join(__dirname, 'server.js'),
    path.join(process.cwd(), 'server.js'),
  ];
  let last;
  for (const c of candidates) {
    try {
      return require(c);
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error('Could not load server.js');
}

const { app } = loadApp();
const handler = serverless(app);
exports.handler = async (event, context) => handler(event, context);
