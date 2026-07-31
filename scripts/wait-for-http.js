#!/usr/bin/env node
/**
 * Polls an HTTP/HTTPS URL until it returns a 2xx/3xx status or times out.
 * Usage: node scripts/wait-for-http.js <url> [timeoutMs=120000] [intervalMs=1000]
 */
const url = process.argv[2];
const timeoutMs = Number(process.argv[3] || 120000);
const intervalMs = Number(process.argv[4] || 1000);

if (!url) {
  console.error('Usage: node scripts/wait-for-http.js <url> [timeoutMs] [intervalMs]');
  process.exit(1);
}

const start = Date.now();

async function check() {
  try {
    const res = await fetch(url, { method: 'GET' });
    if (res.ok || (res.status >= 200 && res.status < 400)) {
      console.log(`wait-for-http: ${url} is up (status ${res.status})`);
      process.exit(0);
    }
    console.log(`wait-for-http: ${url} responded ${res.status}, retrying...`);
  } catch (err) {
    console.log(`wait-for-http: ${url} unreachable (${err.message}), retrying...`);
  }

  if (Date.now() - start > timeoutMs) {
    console.error(`wait-for-http: timed out after ${timeoutMs}ms waiting for ${url}`);
    process.exit(1);
  }

  setTimeout(check, intervalMs);
}

check();
