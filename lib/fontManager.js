import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import fontkit from "fontkit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const fontsDir = path.join(projectRoot, "assets", "fonts");
const registryPath = path.join(fontsDir, "registry.json");

function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureFontStorage() {
  await fs.mkdir(fontsDir, { recursive: true });
  try {
    await fs.access(registryPath);
  } catch {
    await fs.writeFile(registryPath, "{}\n", "utf8");
  }
}

async function readRegistry() {
  await ensureFontStorage();
  const raw = await fs.readFile(registryPath, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeRegistry(registry) {
  await fs.writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

function normalizeFamily(family) {
  return String(family || "").trim().replace(/\s+/g, " ");
}

function familyToGoogleParam(family) {
  return normalizeFamily(family).replace(/\s+/g, "+");
}

function parseGoogleCssUrls(cssText) {
  const urls = [];
  const regex = /url\(([^)]+)\)\s*format\(['\"]?(woff2|woff|truetype|opentype)['\"]?\)/gi;
  for (const match of cssText.matchAll(regex)) {
    const url = match[1].replace(/^['\"]|['\"]$/g, "");
    const format = String(match[2] || "").toLowerCase();
    urls.push({ url, format });
  }
  return urls;
}

async function downloadToFile(url, filePath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  const ab = await response.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(ab));
}

function verifyFontFamily(filePath, requestedFamily) {
  try {
    const font = fontkit.openSync(filePath);
    const family = normalizeFamily(font.familyName);
    const postscript = normalizeFamily(font.postscriptName || "");
    const requested = normalizeFamily(requestedFamily).toLowerCase();
    const ok =
      family.toLowerCase() === requested ||
      family.toLowerCase().includes(requested) ||
      postscript.toLowerCase().includes(requested.replace(/\s+/g, ""));
    return { ok, familyName: family, postscriptName: postscript };
  } catch (error) {
    return { ok: false, familyName: "", postscriptName: "", error: error.message };
  }
}

export async function searchFonts(query) {
  const response = await fetch("https://fonts.google.com/metadata/fonts");
  if (!response.ok) throw new Error("Unable to query fonts catalog.");
  const raw = await response.text();
  const jsonStart = raw.indexOf("{");
  const parsed = JSON.parse(raw.slice(jsonStart));
  const fonts = parsed.familyMetadataList || [];
  const q = String(query || "").trim().toLowerCase();

  const results = fonts
    .filter((f) => !q || String(f.family || "").toLowerCase().includes(q))
    .slice(0, 30)
    .map((f) => ({ family: f.family, category: f.category, axes: f.axes || [] }));

  return results;
}

export async function installFontFromGoogle(family) {
  const cleanFamily = normalizeFamily(family);
  if (!cleanFamily) throw new Error("Font family is required.");

  await ensureFontStorage();
  const cssUrl = `https://fonts.googleapis.com/css2?family=${familyToGoogleParam(cleanFamily)}:wght@400;700&display=swap`;
  const cssRes = await fetch(cssUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });
  if (!cssRes.ok) throw new Error(`Google Fonts CSS lookup failed (${cssRes.status}).`);

  const cssText = await cssRes.text();
  const urls = parseGoogleCssUrls(cssText);
  if (!urls.length) throw new Error("No downloadable font files found for this family.");

  const familyDir = path.join(fontsDir, slugify(cleanFamily));
  await fs.mkdir(familyDir, { recursive: true });

  const downloaded = [];
  for (let i = 0; i < Math.min(urls.length, 4); i += 1) {
    const item = urls[i];
    const ext = item.format === "truetype" ? "ttf" : item.format === "opentype" ? "otf" : item.format;
    const filePath = path.join(familyDir, `${slugify(cleanFamily)}-${i + 1}.${ext}`);
    await downloadToFile(item.url, filePath);

    const verification = verifyFontFamily(filePath, cleanFamily);
    downloaded.push({
      filePath,
      format: item.format,
      verification
    });
  }

  const verified = downloaded.some((d) => d.verification.ok);
  if (!verified) {
    throw new Error("Font files downloaded but family verification failed.");
  }

  const registry = await readRegistry();
  registry[cleanFamily] = {
    family: cleanFamily,
    updatedAt: new Date().toISOString(),
    files: downloaded.map((d) => ({
      path: d.filePath,
      format: d.format,
      verifiedFamily: d.verification.familyName
    }))
  };
  await writeRegistry(registry);

  return {
    family: cleanFamily,
    files: downloaded,
    registryPath
  };
}

export async function findInstalledFontPath(preferredFamily) {
  const registry = await readRegistry();
  const preferred = normalizeFamily(preferredFamily).toLowerCase();

  for (const entry of Object.values(registry)) {
    const family = normalizeFamily(entry.family).toLowerCase();
    if (!family) continue;
    if (family === preferred || family.includes(preferred) || preferred.includes(family)) {
      const candidate = entry.files?.find((f) => f.path);
      if (candidate) return candidate.path;
    }
  }

  return null;
}

export async function installFamilyToSystemFonts(family) {
  const cleanFamily = normalizeFamily(family);
  if (!cleanFamily) throw new Error("Font family is required.");

  const registry = await readRegistry();
  const entry = registry[cleanFamily];
  if (!entry?.files?.length) {
    throw new Error("Font is not installed in local registry. Run install first.");
  }

  const home = process.env.HOME;
  if (!home) throw new Error("HOME environment variable not set.");

  const targetDir =
    process.platform === "darwin"
      ? path.join(home, "Library", "Fonts")
      : path.join(home, ".local", "share", "fonts");

  await fs.mkdir(targetDir, { recursive: true });

  const copied = [];
  for (const file of entry.files) {
    const ext = path.extname(file.path).toLowerCase();
    if (![ ".ttf", ".otf", ".woff", ".woff2" ].includes(ext)) continue;
    const dest = path.join(targetDir, path.basename(file.path));
    await fs.copyFile(file.path, dest);
    copied.push(dest);
  }

  if (!copied.length) {
    throw new Error("No compatible font files found to copy to system fonts.");
  }

  return { family: cleanFamily, targetDir, copied };
}
