import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

// Boot the real app on a random free port and hit it over HTTP, exactly the
// way the deploy script's health check will. No test-only dependencies.
let server;
let baseUrl;

before(async () => {
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GET /health reports ok and a version', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.version, 'string');
  assert.ok(body.version.length > 0);
  assert.equal(typeof body.uptimeSeconds, 'number');
});

test('GET /tours lists every tour', async () => {
  const res = await fetch(`${baseUrl}/tours`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.count, 4);
  assert.equal(body.tours.length, 4);
  assert.ok(body.tours.every((t) => t.id && t.name && t.priceUsd > 0));
});

test('GET /tours/:id returns one tour', async () => {
  const res = await fetch(`${baseUrl}/tours/mangrove-kayak`);
  assert.equal(res.status, 200);
  const tour = await res.json();
  assert.equal(tour.name, 'Mangrove Kayak Safari');
  assert.equal(tour.capacity, 10);
});

test('GET /tours/:id returns JSON 404 for an unknown tour', async () => {
  const res = await fetch(`${baseUrl}/tours/does-not-exist`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.match(body.error, /not found/);
});

test('unknown routes return JSON 404, not HTML', async () => {
  const res = await fetch(`${baseUrl}/nope`);
  assert.equal(res.status, 404);
  assert.match(res.headers.get('content-type'), /application\/json/);
});
