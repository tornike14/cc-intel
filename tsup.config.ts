import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'node18',
  },
  {
    entry: { 'cli/index': 'src/cli/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    target: 'node18',
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
