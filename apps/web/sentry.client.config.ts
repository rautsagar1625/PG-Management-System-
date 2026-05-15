import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,    // mask text for privacy
        blockAllMedia: true,
      }),
    ],

    beforeSend(event) {
      // Never send events in development unless DSN explicitly set
      if (process.env.NODE_ENV === 'development' && !dsn) return null;
      return event;
    },
  });
}
