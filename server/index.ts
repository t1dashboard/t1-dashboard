import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import apiRouter from "./api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Parse JSON bodies (50MB limit for large Excel uploads)
  app.use(express.json({ limit: "50mb" }));

  // Mount API routes FIRST - before any static file serving
  app.use("/api", apiRouter);

  // Only serve static files in production
  if (process.env.NODE_ENV === "production") {
    const staticPath = path.resolve(__dirname, "public");
    app.use(express.static(staticPath));

    // Handle client-side routing - serve index.html for all non-API routes
    app.get("*", (_req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });
  }

  // Use PORT env var, fallback to 3001 for dev (Vite runs on 3000), 3000 for production
  const port = process.env.PORT || (process.env.NODE_ENV === "production" ? 3000 : 3001);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
