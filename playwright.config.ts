import { defineConfig } from "@playwright/test";
import sparticuz from "@sparticuz/chromium";

// Di mesin biasa: `npx playwright install chromium` sudah cukup, tanpa variabel apa pun.
// Di sandbox tanpa akses CDN Playwright: set UKBI_SANDBOX_BROWSER=1 (binary dari @sparticuz/chromium).
const sandbox = process.env.UKBI_SANDBOX_BROWSER === "1";
const launchOptions = sandbox
  ? {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: (sparticuz.args as string[]).filter((a) => a !== "--single-process"),
    }
  : {};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: "http://localhost:3123",
    launchOptions,
  },
  webServer: {
    command: "npx next start -p 3123",
    url: "http://localhost:3123",
    reuseExistingServer: false,
    timeout: 60_000,
    env: { APP_DB_FILE: `/tmp/ukbi-e2e-${Date.now()}/app.db`, NEXT_TELEMETRY_DISABLED: "1", ADMIN_EMAILS: "admin@uji.test" },
  },
});
