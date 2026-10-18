import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  root: 'apps/dashboard', plugins: [react()],
  build: { outDir: '../../dist/dashboard', emptyOutDir: true },
  server: { host: '127.0.0.1', port: 3001, strictPort: true },
});
