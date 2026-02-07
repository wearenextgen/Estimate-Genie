import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { analyzePdf, mergeProfiles } from "./lib/pdfAnalysis.js";
import { buildEstimateContent, renderEstimateHtml } from "./lib/estimateComposer.js";
import { renderEstimatePdf } from "./lib/pdfRenderer.js";
import { findInstalledFontPath, installFontFromGoogle, searchFonts } from "./lib/fontManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "uploads");

await fs.mkdir(uploadsDir, { recursive: true });

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  dest: uploadsDir,
  limits: {
    files: 11,
    fileSize: 20 * 1024 * 1024
  }
});

function toDataUri(file, buffer) {
  if (!file) return null;
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mime = ext === ".svg"
    ? "image/svg+xml"
    : ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : "image/png";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function cleanup(paths) {
  await Promise.all(
    paths.map(async (p) => {
      try {
        await fs.unlink(p);
      } catch {
        // ignore cleanup failures
      }
    })
  );
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/fonts/search", async (req, res) => {
  try {
    const q = String(req.query.q || "");
    const results = await searchFonts(q);
    res.json({ query: q, results });
  } catch (error) {
    res.status(500).json({ error: error.message || "Font search failed." });
  }
});

app.post("/api/fonts/install", async (req, res) => {
  try {
    const family = String(req.body.family || "").trim();
    if (!family) return res.status(400).json({ error: "family is required." });
    const result = await installFontFromGoogle(family);
    res.json({
      family: result.family,
      files: result.files.map((f) => ({
        path: f.filePath,
        format: f.format,
        verified: f.verification.ok,
        detectedFamily: f.verification.familyName,
        postscriptName: f.verification.postscriptName
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Font install failed." });
  }
});

app.post("/api/analyze", upload.array("pdfs", 10), async (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: "Upload at least one PDF." });
  if (files.length > 10) return res.status(400).json({ error: "Maximum 10 PDFs allowed." });

  const savedPaths = files.map((f) => f.path);

  try {
    const nonPdf = files.find((f) => path.extname(f.originalname || "").toLowerCase() !== ".pdf");
    if (nonPdf) return res.status(400).json({ error: `File ${nonPdf.originalname} is not a PDF.` });

    const profiles = [];
    for (const file of files) {
      const profile = await analyzePdf(file.path);
      profiles.push({ filename: file.originalname, ...profile });
    }

    const mergedProfile = mergeProfiles(profiles);
    return res.json({
      styleProfile: mergedProfile,
      filesAnalyzed: profiles.length,
      perFile: profiles.map((p) => ({
        filename: p.filename,
        pages: p.pages,
        primaryFont: p.primaryFont,
        headingSize: p.sizes.heading,
        bodySize: p.sizes.body,
        colors: p.colors
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Failed to analyze PDFs." });
  } finally {
    await cleanup(savedPaths);
  }
});

app.post(
  "/api/generate",
  upload.fields([
    { name: "pdfs", maxCount: 10 },
    { name: "logo", maxCount: 1 }
  ]),
  async (req, res) => {
    const pdfs = req.files?.pdfs || [];
    if (!pdfs.length) return res.status(400).json({ error: "Upload at least one PDF." });

    const prompt = String(req.body.prompt || "").trim();
    if (!prompt) return res.status(400).json({ error: "Prompt is required." });

    const savedPaths = pdfs.map((f) => f.path);

    try {
      const profiles = [];
      for (const file of pdfs) {
        const profile = await analyzePdf(file.path);
        profiles.push(profile);
      }
      const merged = mergeProfiles(profiles);

      const logoFile = req.files?.logo?.[0] || null;
      let logoDataUri = null;
      let logoBuffer = null;
      if (logoFile) {
        logoBuffer = await fs.readFile(logoFile.path);
        logoDataUri = toDataUri(logoFile, logoBuffer);
      }

      const content = await buildEstimateContent({
        prompt,
        styleProfile: merged,
        sourceText: merged.sampleText || ""
      });

      const html = renderEstimateHtml({ content, styleProfile: merged, logoDataUri });

      const fontPath = await findInstalledFontPath(merged.primaryFont);
      const pdfBuffer = await renderEstimatePdf({
        content,
        styleProfile: merged,
        fontPath,
        logoBuffer
      });

      return res.json({
        styleProfile: merged,
        content,
        html,
        pdfBase64: pdfBuffer.toString("base64"),
        pdfFileName: "estimate.pdf",
        llmConfigured: Boolean(process.env.LLM_BASE_URL && process.env.LLM_MODEL),
        pdfFont: fontPath || "Helvetica"
      });
    } catch (error) {
      return res.status(500).json({ error: error?.message || "Failed to generate estimate." });
    } finally {
      const logoPath = req.files?.logo?.[0]?.path;
      await cleanup(logoPath ? [...savedPaths, logoPath] : savedPaths);
    }
  }
);

app.listen(port, () => {
  console.log(`Estimate Genie running on http://localhost:${port}`);
});
