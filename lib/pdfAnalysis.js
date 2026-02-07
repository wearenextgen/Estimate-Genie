import { readFile } from "node:fs/promises";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

// In Node.js, we use disableWorker mode for better compatibility
// Workers are primarily for browser environments

const RGB_COLOR_REGEX = /(\d*\.?\d+)\s+(\d*\.?\d+)\s+(\d*\.?\d+)\s+(rg|RG)/g;
const HEX_REGEX = /#([0-9a-fA-F]{6})\b/g;

function toHex(v) {
  const clamped = Math.max(0, Math.min(255, Math.round(v * 255)));
  return clamped.toString(16).padStart(2, "0");
}

function rgbToHex(r, g, b) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function normalizeFontName(fontName) {
  return String(fontName || "Unknown")
    .replace(/^\w+\+/, "")
    .replace(/[-_]/g, " ")
    .trim();
}

function collectHexColors(rawText) {
  const counts = new Map();

  try {
    for (const match of rawText.matchAll(RGB_COLOR_REGEX)) {
      const r = Number.parseFloat(match[1]);
      const g = Number.parseFloat(match[2]);
      const b = Number.parseFloat(match[3]);
      if ([r, g, b].some((n) => Number.isNaN(n) || n < 0 || n > 1)) continue;
      const hex = rgbToHex(r, g, b).toLowerCase();
      counts.set(hex, (counts.get(hex) || 0) + 1);
    }

    for (const match of rawText.matchAll(HEX_REGEX)) {
      const hex = `#${String(match[1]).toLowerCase()}`;
      counts.set(hex, (counts.get(hex) || 0) + 1);
    }
  } catch (error) {
    // If color extraction fails, continue without colors
    console.warn("Color extraction warning:", error.message);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([hex, hits]) => ({ hex, hits }));
}

function mean(numbers) {
  if (numbers.length === 0) return 0;
  return numbers.reduce((acc, n) => acc + n, 0) / numbers.length;
}

function safeText(item) {
  return String(item?.str || "").replace(/\s+/g, " ").trim();
}

function extractFontSize(item) {
  // Try multiple methods to extract font size
  if (item.height && item.height > 0) return Math.abs(item.height);
  if (item.transform && item.transform[0]) return Math.abs(item.transform[0]);
  if (item.width && item.width > 0) return Math.abs(item.width);
  return 0;
}

export async function analyzePdf(filePath) {
  let rawBuffer;
  let data;
  let pdf;

  try {
    rawBuffer = await readFile(filePath);
    data = new Uint8Array(rawBuffer);
  } catch (error) {
    throw new Error(`Failed to read PDF file: ${error.message}`);
  }

  try {
    const loadingTask = pdfjs.getDocument({
      data,
      disableWorker: true, // Use main thread in Node.js
      verbosity: 0, // Reduce console noise
      stopAtErrors: false, // Continue parsing even with errors
      useSystemFonts: true // Use system fonts if available
    });
    pdf = await loadingTask.promise;
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }

  if (!pdf || pdf.numPages === 0) {
    throw new Error("PDF appears to be empty or corrupted");
  }

  const fontCounts = new Map();
  const sizeBuckets = [];
  const punctuation = { commas: 0, periods: 0, colons: 0, semicolons: 0, bullets: 0 };
  const weights = { boldLike: 0, regularLike: 0 };
  const xPositions = [];
  const yPositions = [];
  const sampleBlocks = [];
  let totalTextLength = 0;

  // Process pages with error handling
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();

      if (!textContent || !textContent.items) {
        continue;
      }

      for (const item of textContent.items) {
        try {
          const text = safeText(item);
          if (!text || text.length === 0) continue;

          totalTextLength += text.length;

          // Collect sample text (prioritize longer blocks)
          if (sampleBlocks.length < 60 || (text.length > 20 && sampleBlocks.length < 100)) {
            sampleBlocks.push(text);
          }

          const fontName = normalizeFontName(item.fontName || "Unknown");
          fontCounts.set(fontName, (fontCounts.get(fontName) || 0) + text.length);

          const fontSize = extractFontSize(item);
          if (fontSize > 0 && fontSize < 200) { // Sanity check for font sizes
            sizeBuckets.push(fontSize);
          }

          const x = item.transform?.[4] || 0;
          const y = item.transform?.[5] || 0;
          if (x >= 0 && y >= 0) {
            xPositions.push(x);
            yPositions.push(viewport.height - y);
          }

          // Count punctuation
          punctuation.commas += (text.match(/,/g) || []).length;
          punctuation.periods += (text.match(/\./g) || []).length;
          punctuation.colons += (text.match(/:/g) || []).length;
          punctuation.semicolons += (text.match(/;/g) || []).length;
          punctuation.bullets += (text.match(/[•●▪◦]/g) || []).length;

          // Detect font weight
          const fontNameLower = fontName.toLowerCase();
          if (/bold|semi ?bold|black|heavy|extra ?bold/i.test(fontNameLower)) {
            weights.boldLike += text.length;
          } else {
            weights.regularLike += text.length;
          }
        } catch (itemError) {
          // Skip problematic items but continue processing
          console.warn(`Error processing text item on page ${pageNum}:`, itemError.message);
          continue;
        }
      }
    } catch (pageError) {
      // Log but continue with other pages
      console.warn(`Error processing page ${pageNum}:`, pageError.message);
      continue;
    }
  }

  // Ensure we have some data
  if (totalTextLength === 0) {
    throw new Error("No extractable text found in PDF");
  }

  const fontRanking = [...fontCounts.entries()].sort((a, b) => b[1] - a[1]);
  const sortedSizes = [...sizeBuckets].sort((a, b) => a - b);
  
  // Calculate body and heading sizes more intelligently
  let bodySize = 11;
  let headingSize = 16;
  
  if (sortedSizes.length > 0) {
    // Body size: median of all sizes
    bodySize = sortedSizes[Math.floor(sortedSizes.length * 0.5)] || 11;
    // Heading size: 90th percentile or 1.5x body size, whichever is larger
    headingSize = Math.max(
      sortedSizes[Math.floor(sortedSizes.length * 0.9)] || bodySize * 1.35,
      bodySize * 1.35
    );
  }

  const margins = {
    left: xPositions.length > 0 ? Math.max(0, Math.min(...xPositions)) : 32,
    top: yPositions.length > 0 ? Math.max(0, Math.min(...yPositions)) : 32,
    right: 32,
    bottom: 32
  };

  // Extract colors from raw PDF text
  const rawText = rawBuffer.toString("latin1");
  const colorsDetailed = collectHexColors(rawText);

  return {
    pages: pdf.numPages,
    fonts: fontRanking.slice(0, 6).map(([name]) => name),
    primaryFont: fontRanking[0]?.[0] || "Helvetica",
    secondaryFont: fontRanking[1]?.[0] || fontRanking[0]?.[0] || "Helvetica",
    sizes: {
      body: Number(bodySize.toFixed(1)),
      heading: Number(headingSize.toFixed(1)),
      avg: Number(mean(sizeBuckets).toFixed(1))
    },
    colors: colorsDetailed.length
      ? colorsDetailed.map((c) => c.hex)
      : ["#000000", "#1f2937", "#4b5563"],
    colorsDetailed,
    emphasis: {
      boldRatio: Number(
        (weights.boldLike / Math.max(1, weights.boldLike + weights.regularLike)).toFixed(2)
      )
    },
    punctuation,
    margins,
    sampleText: sampleBlocks.join(" ").slice(0, 5000) // Increased sample text
  };
}

export function mergeProfiles(profiles) {
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
  const allFonts = new Map();
  const allColors = new Map();

  for (const profile of profiles) {
    for (const font of profile.fonts || []) allFonts.set(font, (allFonts.get(font) || 0) + 1);
    for (const color of profile.colors || []) allColors.set(color, (allColors.get(color) || 0) + 1);
  }

  const sortedFonts = [...allFonts.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f);
  const sortedColors = [...allColors.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);

  return {
    docCount: profiles.length,
    fonts: sortedFonts.slice(0, 6),
    primaryFont: sortedFonts[0] || "Helvetica",
    secondaryFont: sortedFonts[1] || sortedFonts[0] || "Helvetica",
    sizes: {
      body: Number(avg(profiles.map((p) => p.sizes.body)).toFixed(1)),
      heading: Number(avg(profiles.map((p) => p.sizes.heading)).toFixed(1)),
      avg: Number(avg(profiles.map((p) => p.sizes.avg)).toFixed(1))
    },
    colors: sortedColors.slice(0, 6),
    emphasis: { boldRatio: Number(avg(profiles.map((p) => p.emphasis.boldRatio)).toFixed(2)) },
    punctuation: {
      commas: Math.round(avg(profiles.map((p) => p.punctuation.commas))),
      periods: Math.round(avg(profiles.map((p) => p.punctuation.periods))),
      colons: Math.round(avg(profiles.map((p) => p.punctuation.colons))),
      semicolons: Math.round(avg(profiles.map((p) => p.punctuation.semicolons))),
      bullets: Math.round(avg(profiles.map((p) => p.punctuation.bullets)))
    },
    margins: {
      left: Math.round(avg(profiles.map((p) => p.margins.left))),
      top: Math.round(avg(profiles.map((p) => p.margins.top))),
      right: Math.round(avg(profiles.map((p) => p.margins.right))),
      bottom: Math.round(avg(profiles.map((p) => p.margins.bottom)))
    },
    sampleText: profiles
      .map((p) => p.sampleText)
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 12000)
  };
}
