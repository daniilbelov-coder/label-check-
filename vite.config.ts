import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      host: true, 
    },
    preview: {
      host: true,
      port: 4173,
      allowedHosts: true, // Critical for Railway deployment
    },
    define: {
      // Pass Environment Variables to the client
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.BASE_URL': JSON.stringify(env.BASE_URL),
    },
  };
});