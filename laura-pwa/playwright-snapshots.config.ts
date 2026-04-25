import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'laura-visual-snapshots.spec.ts',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:3100' },
  reporter: [['list']],
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
