import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',

    integrations: [
      // OB-2: Fastify integration — instruments each request as a Sentry
      // performance transaction so we can see p50/p95 latency per route.
      // Must be listed here (not in main.ts) because instrument.ts is imported
      // before all other modules so the instrumentation wraps everything.
      Sentry.fastifyIntegration(),

      // OB-3: CPU profiling — captures call stacks during slow transactions.
      // @sentry/profiling-node was already installed but never activated.
      nodeProfilingIntegration(),
    ],

    // OB-4: Route-based sampling — financial routes at 100%, everything else at 10%.
    // "Financial routes" are the ones where a missing trace costs real money:
    //   POST /tenant/pay/*      — Razorpay payment flow
    //   POST /settlements/*     — Settlement calculation + payout
    //   POST /rent/*            — Manual payment recording
    //   POST /jobs/trigger/*    — Manual job triggers that modify data
    tracesSampler: ({ name }: { name: string }) => {
      const critical = ['/pay/', '/settlements/', '/rent/', '/jobs/trigger/'];
      if (critical.some((seg) => name.includes(seg))) return 1.0;
      return process.env.NODE_ENV === 'production' ? 0.1 : 1.0;
    },

    // Profile 100% of sampled transactions (CPU profiling only runs when a
    // transaction is sampled, so this doesn't multiply cost).
    profilesSampleRate: 1.0,

    enabled: process.env.NODE_ENV !== 'test',
  });
}
