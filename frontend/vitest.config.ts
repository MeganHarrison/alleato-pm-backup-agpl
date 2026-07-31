import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, type Plugin } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

import { playwright } from '@vitest/browser-playwright';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// @storybook/nextjs-vite aliases @opentelemetry/api → next/dist/compiled/@opentelemetry/api
// which is a CJS bundle that uses __dirname and crashes in Vite's ESM context.
// This plugin's resolveId hook fires after alias resolution and redirects it to
// the standalone ESM-compatible package.
const fixNextOtelPlugin: Plugin = {
  name: 'fix-next-otel',
  enforce: 'pre',
  resolveId(id) {
    if (
      id === '@opentelemetry/api' ||
      id.includes('next/dist/compiled/@opentelemetry/api')
    ) {
      return path.resolve(dirname, 'node_modules/@opentelemetry/api/build/esm/index.js');
    }
  },
};

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({ configDir: path.join(dirname, '.storybook') }),
          fixNextOtelPlugin,
        ],
        // Exclude from esbuild pre-bundling so our resolveId plugin can intercept
        // the import at runtime and redirect it to the standalone ESM package.
        optimizeDeps: {
          exclude: ['@opentelemetry/api'],
        },
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
