import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import AdmZip from "adm-zip";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Endpoint to download the entire source code as a ZIP
  app.get("/api/download-project", (req, res) => {
    try {
      // Security control: Allow disabling source download globally via environment variable
      if (process.env.ALLOW_SOURCE_DOWNLOAD === "false") {
        res.status(403).send("<h1>403 Forbidden</h1><p>Source download has been disabled by the administrator for security reasons.</p>");
        return;
      }

      const zip = new AdmZip();

      // Files to include
      const filesToInclude = [
        "package.json",
        "tsconfig.json",
        "vite.config.ts",
        "server.ts",
        "index.html",
        ".gitignore",
        ".env.example",
        "metadata.json"
      ];

      filesToInclude.forEach(file => {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
          zip.addLocalFile(filePath);
        }
      });

      // Folders to include
      const srcPath = path.join(process.cwd(), "src");
      if (fs.existsSync(srcPath)) {
        zip.addLocalFolder(srcPath, "src");
      }

      const assetsPath = path.join(process.cwd(), "assets");
      if (fs.existsSync(assetsPath)) {
        zip.addLocalFolder(assetsPath, "assets");
      }

      const buffer = zip.toBuffer();

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", "attachment; filename=curtain-install-app.zip");
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);
    } catch (err: any) {
      console.error("ZIP Generation Error:", err);
      res.status(500).json({ error: "Failed to generate ZIP file", message: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
