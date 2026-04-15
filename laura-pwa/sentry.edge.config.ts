import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN_PWA,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN_PWA,
  tracesSampleRate: 0.1,
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
});
