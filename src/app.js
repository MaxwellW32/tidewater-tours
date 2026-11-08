import express from 'express';
import { tours, findTour } from './tours.js';

// APP_VERSION is baked into the image at build time (see Dockerfile ARG).
// The pipeline sets it to the git commit SHA, so /health tells you exactly
// which commit is running - that is how we prove a deploy or rollback worked.
export const version = process.env.APP_VERSION || 'dev';

const startedAt = Date.now();

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.get('/', (_req, res) => {
    res.json({
      service: 'tidewater-tours-api',
      version,
      endpoints: ['/health', '/tours', '/tours/:id'],
    });
  });

  // Health check: used by Docker HEALTHCHECK, the deploy script and the
  // rollback script. Must be cheap and must not depend on anything external.
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/tours', (_req, res) => {
    res.json({ count: tours.length, tours });
  });

  app.get('/tours/:id', (req, res) => {
    const tour = findTour(req.params.id);
    if (!tour) {
      return res.status(404).json({ error: `tour '${req.params.id}' not found` });
    }
    return res.json(tour);
  });

  // JSON 404 for anything else, so clients never get an HTML error page.
  app.use((req, res) => {
    res.status(404).json({ error: `no route for ${req.method} ${req.path}` });
  });

  return app;
}
