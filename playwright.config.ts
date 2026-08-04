import { defineConfig } from '@playwright/test';

export default defineConfig({
	// Keep local nested worktrees from being collected against this checkout's preview server.
	testDir: 'src',
	webServer: { command: 'npm run build && npm run preview', port: 4173 },
	testMatch: '**/*.e2e.{ts,js}'
});
