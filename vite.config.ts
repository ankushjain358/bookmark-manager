import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// https://vite.dev/config/
export default defineConfig(() => {
  const target = process.env.BUILD_TARGET || 'standalone';
  const outDir = target === 'extension' ? 'dist/extension' : 'dist/standalone';

  return {
    plugins: [
      react(),
      {
        name: 'copy-manifest',
        closeBundle() {
          if (target === 'extension') {
            const manifestSource = path.resolve(__dirname, 'manifest.json');
            const manifestDest = path.resolve(__dirname, outDir, 'manifest.json');
            if (fs.existsSync(manifestSource)) {
              fs.copyFileSync(manifestSource, manifestDest);
              console.log('Copied manifest.json to dist/extension');
            } else {
              console.error('manifest.json not found in root directory!');
            }
          }
        }
      }
    ],
    resolve: {
      alias: {
        '@platform': path.resolve(
          __dirname,
          target === 'extension'
            ? './src/platform/platform.extension.ts'
            : './src/platform/platform.web.ts'
        )
      }
    },
    build: {
      outDir,
      emptyOutDir: true
    }
  };
});
