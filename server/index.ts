import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultModelBaseUrl, handleGenieChat } from "./genieProxy.js";

interface StudioServerOptions {
  publicRoot?: string;
  apiKey?: string;
  modelBaseUrl?: string;
}

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendFile(response: ServerResponse, filePath: string, method?: string) {
  response.statusCode = 200;
  response.setHeader(
    "Content-Type",
    contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
  );
  response.setHeader(
    "Cache-Control",
    extname(filePath) === ".html"
      ? "no-cache"
      : "public, max-age=31536000, immutable",
  );

  if (method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
}

export function createStudioServer(options: StudioServerOptions = {}) {
  const publicRoot =
    options.publicRoot || fileURLToPath(new URL("./public/", import.meta.url));
  const indexPath = resolve(publicRoot, "index.html");

  return createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "same-origin");

    try {
      const url = new URL(request.url || "/", "http://localhost");

      if (url.pathname === "/healthz") {
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(JSON.stringify({ status: "ok" }));
        return;
      }

      if (url.pathname === "/api/genie/chat") {
        await handleGenieChat(request, response, {
          apiKey: options.apiKey ?? process.env.GENIE_MODEL_AK,
          baseUrl:
            options.modelBaseUrl ??
            process.env.GENIE_MODEL_BASE_URL ??
            defaultModelBaseUrl,
        });
        return;
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        response.statusCode = 405;
        response.setHeader("Allow", "GET, HEAD");
        response.end("Method not allowed");
        return;
      }

      const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const candidate = resolve(publicRoot, relativePath || "index.html");
      const isInsidePublicRoot =
        candidate === publicRoot || candidate.startsWith(`${publicRoot}${sep}`);

      if (
        isInsidePublicRoot &&
        existsSync(candidate) &&
        statSync(candidate).isFile()
      ) {
        sendFile(response, candidate, request.method);
        return;
      }

      if (existsSync(indexPath)) {
        sendFile(response, indexPath, request.method);
        return;
      }

      response.statusCode = 404;
      response.end("Not found");
    } catch (error) {
      console.error("[server] request failed", error);
      response.statusCode = 500;
      response.end("Internal server error");
    }
  });
}

function startServer() {
  const port = Number.parseInt(process.env.PORT || "8080", 10);
  const server = createStudioServer();

  server.listen(port, "0.0.0.0", () => {
    console.log(`[server] LIVE Studio Genie listening on port ${port}`);
  });
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) {
  startServer();
}
