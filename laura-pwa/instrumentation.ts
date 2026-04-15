import * as Sentry from "@sentry/nextjs";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN_PWA,
      enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN_PWA,
      tracesSampleRate: 0.1,
    });
  }
}
