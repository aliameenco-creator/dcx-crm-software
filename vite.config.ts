import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { authHandler, configuration } from './server/auth-core.js';
import { crmHandler } from './server/crm-api.js';
import { mailHandler } from './server/mail-api.js';
import { trackingHandler } from './server/email-tracking-api.js';
import { microsoftOAuthHandler } from './server/microsoft-oauth.js';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), {
    name: 'local-session-api',
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), '');
      server.middlewares.use('/api/microsoft-oauth-callback', (req, res) => { req.url = `/api/microsoft-oauth-callback${req.url || ''}`; microsoftOAuthHandler(req, res, env).catch(() => { res.statusCode = 500; res.end('{"error":"Microsoft connection failed."}'); }); });
      server.middlewares.use('/api/microsoft-oauth', (req, res) => { microsoftOAuthHandler(req, res, env).catch(() => { res.statusCode = 500; res.end('{"error":"Microsoft connection failed."}'); }); });
      server.middlewares.use('/api/tracking', (req, res) => { trackingHandler(req, res, env).catch(() => { res.statusCode = 500; res.end('{"error":"Email tracking request failed."}'); }); });
      server.middlewares.use('/api/mail', (req, res) => { mailHandler(req, res, env).catch(() => { res.statusCode = 500; res.end('{"error":"Unable to process mailbox request."}'); }); });
      server.middlewares.use('/api/crm', (req, res) => { crmHandler(req, res, env).catch(() => { res.statusCode = 500; res.end('{"error":"Unable to process customer request."}'); }); });
      server.middlewares.use('/api/auth', (req, res) => { authHandler(req, res, configuration(env)).catch(() => { res.statusCode = 500; res.end('{"error":"Unable to process login."}'); }); });
    },
  }],
  server: {
    port: 3000,
    open: false,
  },
}));
