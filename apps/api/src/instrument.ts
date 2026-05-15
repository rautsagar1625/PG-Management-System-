import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Only initialise if a DSN is provided — safe to omit in development
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE ?? 'unknown',
    integrations: [nodeProfilingIntegration()],

    // Capture 10% of transactions for performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    beforeSend(event) {
      // Strip raw SQL from breadcrumbs to avoid leaking query contents
      if (Array.isArray(event.breadcrumbs)) {
        event.breadcrumbs = event.breadcrumbs.map((b) =>
          b.category === 'db.sql.query' ? { ...b, message: '[redacted]' } : b,
        );
      }
      return event;
    },
  });
}
