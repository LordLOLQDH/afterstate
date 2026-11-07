import { defineConfig } from 'vite';

export default defineConfig({
  base: '/afterstate/',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
