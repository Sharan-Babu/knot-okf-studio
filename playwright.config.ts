import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [['line'], ['html', { outputFolder: 'test-results/playwright-report', open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  outputDir: 'test-results/artifacts',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
})
