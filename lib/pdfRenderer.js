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

export async function renderEstimatePdf({ content, styleProfile, fontPath, logoBuffer }) {
  const colors = styleProfile?.colors?.length ? styleProfile.colors : ["#0f172a", "#334155", "#64748b"];
  const headingSize = Math.max(14, Math.round(styleProfile?.sizes?.heading || 20));
  const bodySize = Math.max(10, Math.round(styleProfile?.sizes?.body || 12));

  const doc = new PDFDocument({ margin: 44, size: "A4" });
  const bufferPromise = getBufferFromStream(doc);

  if (fontPath) {
    try {
      doc.registerFont("Primary", fontPath);
      doc.font("Primary");
    } catch {
      doc.font("Helvetica");
    }
  } else {
    doc.font("Helvetica");
  }

  const ink = hexToRgb(colors[0]);
  const accent = hexToRgb(colors[1] || colors[0]);
  const muted = hexToRgb(colors[2] || colors[1] || colors[0]);

  doc.rect(44, 44, doc.page.width - 88, 7).fill(`rgb(${accent.r},${accent.g},${accent.b})`);
  doc.fillColor(`rgb(${ink.r},${ink.g},${ink.b})`);

  let y = 60;
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 44, y, { fit: [130, 52], align: "left", valign: "top" });
      y += 58;
    } catch {
      // ignore logo decode failures
    }
  }

  doc.fontSize(Math.round(headingSize * 1.18)).text(content.title || "Project Estimate", 44, y);
  y = doc.y + 8;

  doc
    .fillColor(`rgb(${muted.r},${muted.g},${muted.b})`)
    .fontSize(bodySize)
    .text(content.intro || "", 44, y, { width: doc.page.width - 88, lineGap: 3 });

  y = doc.y + 14;
  doc.fillColor(`rgb(${ink.r},${ink.g},${ink.b})`);

  for (const section of content.sections || []) {
    if (y > doc.page.height - 120) {
      doc.addPage();
      y = 44;
    }

    doc
      .fontSize(headingSize)
      .text(section.heading || "Section", 44, y, { width: doc.page.width - 88 });
    y = doc.y + 6;

    for (const bullet of section.bullets || []) {
      doc
        .fontSize(bodySize)
        .text(`• ${bullet}`, 56, y, {
          width: doc.page.width - 100,
          lineGap: 3
        });
      y = doc.y + 4;
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 44;
      }
    }

    y += 8;
  }

  doc.end();
  return bufferPromise;
}
