import { defineConfig } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // TanStackRouterVite MUST come before React to generate routeTree.gen.ts
    tanstackRouter({ routesDirectory: "./src/routes" }),
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'https://payto-pay.onrender.com',
        changeOrigin: true,
      },
    },
  },
});
