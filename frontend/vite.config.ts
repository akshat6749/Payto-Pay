import { defineConfig, loadEnv } from "vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      // TanStackRouterVite MUST come before React to generate routeTree.gen.ts
      TanStackRouterVite({ routesDirectory: "./src/routes" }),
      react(),
      tailwindcss(),
    ],
    server: {
      proxy: {
        "/api": {
          target: env.VITE_API_URL || "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
  };
});
