import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  // Relative Pfade, damit die App auch in einem Unterordner läuft (z. B. GitHub Pages: /Notiz-App/)
  base: './',
  plugins: [preact()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
