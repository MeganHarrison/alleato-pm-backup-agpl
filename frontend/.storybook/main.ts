import type { StorybookConfig } from '@storybook/nextjs-vite';
import { dirname } from 'node:path';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-mcp"
  ],
  framework: "@storybook/nextjs-vite",
  staticDirs: ["../public"],
  async viteFinal(config) {
    config.resolve ??= {};
    // vite-plugin-storybook-nextjs maps the "@opentelemetry/api" specifier to
    // next/dist/compiled/@opentelemetry/api (a CJS bundle using __dirname that
    // crashes in Vite's ESM context). Override it here — viteFinal runs after
    // all plugins so this wins.
    if (Array.isArray(config.resolve.alias)) {
      const idx = config.resolve.alias.findIndex(
        (a) => typeof a.find === 'string' && a.find === '@opentelemetry/api'
      );
      const replacement = resolve(__dirname, '../node_modules/@opentelemetry/api/build/esm/index.js');
      if (idx >= 0) {
        config.resolve.alias[idx] = { find: '@opentelemetry/api', replacement };
      } else {
        config.resolve.alias.unshift({ find: '@opentelemetry/api', replacement });
      }
    } else {
      config.resolve.alias ??= {};
      (config.resolve.alias as Record<string, string>)['@opentelemetry/api'] =
        resolve(__dirname, '../node_modules/@opentelemetry/api/build/esm/index.js');
    }
    return config;
  },
};
export default config;