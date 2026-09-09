import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { defaultModelBaseUrl, handleGenieChat } from "./server/genieProxy.js";

function genieProxy(apiKey: string | undefined, baseUrl: string): Plugin {
  return {
    name: "genie-model-proxy",
    configureServer(server) {
      server.middlewares.use("/api/genie/chat", (request, response) =>
        handleGenieChat(request, response, { apiKey, baseUrl }),
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_BASE_PATH || "/",
    plugins: [
      react(),
      genieProxy(
        env.GENIE_MODEL_AK,
        env.GENIE_MODEL_BASE_URL || defaultModelBaseUrl,
      ),
    ],
    build: {
      cssMinify: "esbuild",
    },
  };
});
