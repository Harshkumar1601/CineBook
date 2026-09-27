// ============================================================
// API GATEWAY - server.js
// Port: 8000
// Main external entry point for all client requests
// Features:
//   - HTTP proxying to microservices
//   - GraphQL aggregation endpoint
//   - Request logging
//   - CORS
//   - Error handling
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { typeDefs, resolvers } = require('./graphql/schema');

const app = express();
const PORT = process.env.PORT || 8000;

// Service URLs (can be overridden in .env)
const services = {
  USER:     process.env.USER_SERVICE_URL     || 'http://localhost:8001',
  MOVIE:    process.env.MOVIE_SERVICE_URL    || 'http://localhost:8002',
  BOOKING:  process.env.BOOKING_SERVICE_URL  || 'http://localhost:8003',
  SHOW:     process.env.SHOW_SERVICE_URL     || 'http://localhost:8004',
  NOTIFICATION: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8005',
};

// ── Middleware ──────────────────────────────────────────────
app.use(cors());

// Request logging
app.use(
  morgan((tokens, req, res) => {
    return [
      `[API GATEWAY]`,
      tokens.method(req, res),
      tokens.url(req, res),
      '→',
      tokens.status(req, res),
      tokens['response-time'](req, res),
      'ms',
    ].join(' ');
  })
);

// ── Proxy helper factory ─────────────────────────────────────
function createProxy(target, pathRewrite) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    on: {
      error: (err, req, res) => {
        console.error(`[API GATEWAY] Proxy error → ${target}:`, err.message);
        if (!res.headersSent) {
          res.status(503).json({
            success: false,
            message: `Service unavailable: ${target}`,
            error: err.message,
          });
        }
      },
    },
  });
}

// ── REST Proxy Routes ────────────────────────────────────────
// All requests go through the API Gateway only

// /api/users/* → User Service (port 8001)
app.use(
  '/api/users',
  createProxy(services.USER, { '^/api/users': '/users' })
);

// /api/movies/* → Movie Service (port 8002)
app.use(
  '/api/movies',
  createProxy(services.MOVIE, { '^/api/movies': '/movies' })
);

// /api/bookings/* → Booking Service (port 8003)
app.use(
  '/api/bookings',
  createProxy(services.BOOKING, { '^/api/bookings': '/bookings' })
);

// /api/shows/* → Show/Seat Service (port 8004)
app.use(
  '/api/shows',
  createProxy(services.SHOW, { '^/api/shows': '/shows' })
);

// /api/notifications/* → Notification Service (port 8005)
app.use(
  '/api/notifications',
  createProxy(services.NOTIFICATION, { '^/api/notifications': '/notifications' })
);

// ── Health check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    port: PORT,
    services,
  });
});

// ── Start Apollo GraphQL + Express ────────────────────────────
async function startServer() {
  // Apollo Server v4 setup
  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    formatError: (err) => {
      console.error('[GRAPHQL] Error:', err.message);
      return { message: err.message, locations: err.locations, path: err.path };
    },
  });

  await apolloServer.start();
  console.log('[API GATEWAY] Apollo GraphQL server started');

  // Mount GraphQL at /graphql
  app.use(
    '/graphql',
    express.json(),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => ({
        // Pass service URLs as context so resolvers can use them
        services,
      }),
    })
  );

  app.listen(PORT, () => {
    console.log(`[API GATEWAY] Running on http://localhost:${PORT}`);
    console.log(`[API GATEWAY] GraphQL:  http://localhost:${PORT}/graphql`);
    console.log('[API GATEWAY] REST routes:');
    console.log(`  /api/users/*         → ${services.USER}`);
    console.log(`  /api/movies/*        → ${services.MOVIE}`);
    console.log(`  /api/bookings/*      → ${services.BOOKING}`);
    console.log(`  /api/shows/*         → ${services.SHOW}`);
    console.log(`  /api/notifications/* → ${services.NOTIFICATION}`);
  });
}

startServer().catch((err) => {
  console.error('[API GATEWAY] Fatal startup error:', err);
  process.exit(1);
});
