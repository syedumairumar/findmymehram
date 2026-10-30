import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:5183", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- --port 5183 --strictPort",
    url: "http://127.0.0.1:5183",
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: "https://restoration-test.supabase.co",
      VITE_SUPABASE_ANON_KEY: "test-only-public-key",
      VITE_PAYMENTS_ENABLED: "true",
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
});
