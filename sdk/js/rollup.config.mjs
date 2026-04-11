/**
 * Rollup config – produces a single UMD bundle for CDN delivery.
 *
 * Output: dist/umd/share-installs-sdk.min.js
 * Global: window.ShareInstalls
 *
 * Build: npm run build:cdn
 */

import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/umd/share-installs-sdk.min.js',
    format: 'umd',
    name: 'ShareInstalls',
    sourcemap: true,
    exports: 'named',
  },
  plugins: [
    resolve({ browser: true }),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      declarationMap: false,
      sourceMap: true,
    }),
    terser({
      compress: { passes: 2 },
      mangle: true,
      format: { comments: false },
    }),
  ],
};
