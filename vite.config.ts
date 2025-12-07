import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      host: true, // Listen on 0.0.0.0
    },
    preview: {
      host: true,
      port: 4173,
      allowedHosts: true, // Разрешаем любые хосты (важно для Railway)
    },
    define: {
      // Vital for using process.env in the browser code
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.BASE_URL': JSON.stringify(env.BASE_URL),
    },
  };
});