import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Ensure workspace packages are resolved from source
    preserveSymlinks: true,
  },
});
