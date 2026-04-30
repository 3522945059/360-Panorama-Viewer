import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import http from "node:http";

const HOST = "127.0.0.1";
const PORT = 4173;
const ROOT = resolve(".");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function send(response, statusCode, body, contentType) {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function resolvePath(urlPath) {
  const pathname = urlPath === "/" ? "/index.html" : urlPath;
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  return join(ROOT, safePath);
}

const server = http.createServer((request, response) => {
  if (!request.url) {
    send(response, 400, "Bad Request", "text/plain; charset=utf-8");
    return;
  }

  const requestPath = new URL(request.url, `http://${HOST}:${PORT}`).pathname;
  const filePath = resolvePath(requestPath);

  if (!filePath.startsWith(ROOT)) {
    send(response, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  if (!existsSync(filePath)) {
    send(response, 404, "Not Found", "text/plain; charset=utf-8");
    return;
  }

  const stats = statSync(filePath);

  if (stats.isDirectory()) {
    send(response, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  const contentType =
    MIME_TYPES[extname(filePath).toLowerCase()] ||
    "application/octet-stream";

  response.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
});

server.listen(PORT, HOST, () => {
  console.log(`Panorama viewer ready at http://${HOST}:${PORT}`);
});
