// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 30000,
    expect: {
        timeout: 5000
    },
    use: {
        baseURL: 'http://127.0.0.1:5173',
        trace: 'on-first-retry'
    },
    webServer: {
        command: 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\serve.ps1 5173',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: true,
        timeout: 15000
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ]
});
