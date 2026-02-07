import PDFDocument from "pdfkit";

function hexToRgb(hex) {
  const clean = String(hex || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return { r: 15, g: 23, b: 42 };
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16)
  };
}

async function getBufferFromStream(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function sanitizeText(text) {
  if (typeof text !== "string") return "";
  // Remove or replace problematic characters that PDFKit might have issues with
  return text
    .replace(/\u0000/g, "") // Remove null bytes
    .replace(/\uFFFD/g, "?") // Replace replacement characters
    .trim();
}

export async function renderEstimatePdf({ content, styleProfile, fontPath, logoBuffer }) {
  const colors = styleProfile?.colors?.length ? styleProfile.colors : ["#0f172a", "#334155", "#64748b"];
  const headingSize = Math.max(14, Math.round(styleProfile?.sizes?.heading || 20));
  const bodySize = Math.max(10, Math.round(styleProfile?.sizes?.body || 12));

  const doc = new PDFDocument({ 
    margin: 44, 
    size: "A4",
    autoFirstPage: true
  });
  const bufferPromise = getBufferFromStream(doc);

  // Register and use font
  if (fontPath) {
    try {
      doc.registerFont("Primary", fontPath);
      doc.font("Primary");
    } catch (error) {
      console.warn("Font registration failed, using Helvetica:", error.message);
      doc.font("Helvetica");
    }
  } else {
    doc.font("Helvetica");
  }

  const ink = hexToRgb(colors[0]);
  const accent = hexToRgb(colors[1] || colors[0]);
  const muted = hexToRgb(colors[2] || colors[1] || colors[0]);

  // Header bar
  try {
    doc.rect(44, 44, doc.page.width - 88, 7).fill(`rgb(${accent.r},${accent.g},${accent.b})`);
  } catch (error) {
    console.warn("Header bar rendering error:", error.message);
  }
  
  doc.fillColor(`rgb(${ink.r},${ink.g},${ink.b})`);

  let y = 60;
  
  // Logo handling
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 44, y, { 
        fit: [130, 52], 
        align: "left", 
        valign: "top" 
      });
      y += 58;
    } catch (error) {
      console.warn("Logo rendering failed:", error.message);
      // Continue without logo
    }
  }

  // Title
  const title = sanitizeText(content?.title || "Project Estimate");
  try {
    doc.fontSize(Math.round(headingSize * 1.18));
    doc.text(title, 44, y, { 
      width: doc.page.width - 88,
      ellipsis: true
    });
    y = doc.y + 8;
  } catch (error) {
    console.warn("Title rendering error:", error.message);
    y += headingSize + 8;
  }

  // Introduction
  const intro = sanitizeText(content?.intro || "");
  if (intro) {
    try {
      doc
        .fillColor(`rgb(${muted.r},${muted.g},${muted.b})`)
        .fontSize(bodySize)
        .text(intro, 44, y, { 
          width: doc.page.width - 88, 
          lineGap: 3,
          ellipsis: true
        });
      y = doc.y + 14;
    } catch (error) {
      console.warn("Intro rendering error:", error.message);
      y += bodySize * 2 + 14;
    }
  } else {
    y += 14;
  }
  
  doc.fillColor(`rgb(${ink.r},${ink.g},${ink.b})`);

  // Sections
  const sections = content?.sections || [];
  if (sections.length === 0) {
    // Add a default section if none provided
    sections.push({
      heading: "Project Details",
      bullets: ["Details to be confirmed"]
    });
  }

  for (const section of sections) {
    // Check if we need a new page
    if (y > doc.page.height - 120) {
      doc.addPage();
      y = 44;
    }

    const sectionHeading = sanitizeText(section?.heading || "Section");
    try {
      doc.fontSize(headingSize);
      doc.text(sectionHeading, 44, y, { 
        width: doc.page.width - 88,
        ellipsis: true
      });
      y = doc.y + 6;
    } catch (error) {
      console.warn("Section heading rendering error:", error.message);
      y += headingSize + 6;
    }

    const bullets = section?.bullets || [];
    if (bullets.length === 0) {
      // Add a default bullet if section is empty
      bullets.push("Details to be confirmed");
    }

    for (const bullet of bullets) {
      const bulletText = sanitizeText(bullet);
      if (!bulletText) continue;

      // Check if we need a new page before adding bullet
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 44;
      }

      try {
        doc
          .fontSize(bodySize)
          .text(`• ${bulletText}`, 56, y, {
            width: doc.page.width - 100,
            lineGap: 3,
            ellipsis: true
          });
        y = doc.y + 4;
      } catch (error) {
        console.warn("Bullet rendering error:", error.message);
        y += bodySize + 4;
      }
    }

    y += 8;
  }

  try {
    doc.end();
  } catch (error) {
    console.error("Error finalizing PDF:", error.message);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }

  return bufferPromise;
}
