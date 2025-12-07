import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      host: true,
    },
    preview: {
      host: true,
      port: 4173,
      allowedHosts: true, // Required for Railway to prevent "Blocked Request"
    },
    define: {
      // Explicitly inject environment variables globally so they are available in the client bundle
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.BASE_URL': JSON.stringify(env.BASE_URL),
    },
  };
});