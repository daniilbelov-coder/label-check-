import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true,
  },
  build: {
    sourcemap: false, // БЕЗОПАСНОСТЬ: Отключаем source maps в production
  },
  // УДАЛЕНО: define блок - никогда не внедряем секреты в клиентский код
});
