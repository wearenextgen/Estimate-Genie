function fallbackSections(prompt) {
  const lines = String(prompt || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const summary = lines[0] || "Custom estimate request";
  const scope = lines.slice(1, 8);

  return {
    title: "Project Estimate",
    intro: summary,
    sections: [
      {
        heading: "Scope Overview",
        bullets: scope.length ? scope : ["Detailed scope to be confirmed during kickoff"]
      },
      {
        heading: "Deliverables",
        bullets: [
          "Discovery and planning",
          "Execution and quality control",
          "Final delivery with handoff"
        ]
      },
      {
        heading: "Pricing & Terms",
        bullets: [
          "Estimate is based on the current brief and assumptions",
          "Changes in scope may update timeline and pricing",
          "Payment terms: Net 15 unless otherwise specified"
        ]
      }
    ]
  };
}

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function aiSections({ prompt, styleProfile, sourceText }) {
  const baseUrl = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;

  if (!baseUrl || !model) return null;

  const styleHint = JSON.stringify(
    {
      primaryFont: styleProfile.primaryFont,
      secondaryFont: styleProfile.secondaryFont,
      sizes: styleProfile.sizes,
      punctuation: styleProfile.punctuation,
      boldRatio: styleProfile.emphasis?.boldRatio
    },
    null,
    2
  );

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.LLM_API_KEY ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` } : {})
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You create concise estimate docs. Return strict JSON with keys title, intro, sections. sections must be array of {heading, bullets:string[]}."
        },
        {
          role: "user",
          content: `Client request:\n${prompt}\n\nStyle profile:\n${styleHint}\n\nReference snippets:\n${sourceText}`
        }
      ]
    })
  });

  if (!response.ok) return null;

  const json = await response.json();
  const raw = json?.choices?.[0]?.message?.content;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.sections?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function buildEstimateContent({ prompt, styleProfile, sourceText }) {
  return (await aiSections({ prompt, styleProfile, sourceText })) || fallbackSections(prompt);
}

export function renderEstimateHtml({ content, styleProfile, logoDataUri }) {
  const primary = styleProfile?.primaryFont || "Helvetica";
  const secondary = styleProfile?.secondaryFont || primary;
  const colors = styleProfile?.colors?.length ? styleProfile.colors : ["#0f172a", "#334155", "#64748b"];
  const headingSize = styleProfile?.sizes?.heading || 20;
  const bodySize = styleProfile?.sizes?.body || 12;

  const sectionHtml = content.sections
    .map((section) => {
      const bullets = (section.bullets || [])
        .map((bullet) => `<li>${escapeHtml(String(bullet))}</li>`)
        .join("");
      return `<section class="estimate-section"><h2>${escapeHtml(String(section.heading || "Section"))}</h2><ul>${bullets}</ul></section>`;
    })
    .join("\n");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(content.title || "Project Estimate")}</title>
    <style>
      body { margin: 0; padding: 40px; background: #f8fafc; color: ${colors[0]}; font-family: "${primary}", "${secondary}", sans-serif; }
      .estimate-card { max-width: 840px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-top: 8px solid ${colors[1] || colors[0]}; border-radius: 14px; padding: 34px; }
      .brand { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
      .brand img { max-height: 58px; width: auto; }
      h1 { margin: 0 0 12px; font-size: ${Math.round(headingSize * 1.2)}px; line-height: 1.15; }
      .intro { margin-bottom: 20px; color: ${colors[2] || colors[1] || colors[0]}; font-size: ${bodySize}px; line-height: 1.55; }
      .estimate-section { margin: 16px 0; padding-top: 10px; border-top: 1px solid #e2e8f0; }
      h2 { margin: 0 0 10px; font-size: ${Math.round(headingSize)}px; }
      ul { margin: 0; padding-left: 20px; font-size: ${bodySize}px; line-height: 1.55; }
      li { margin: 6px 0; }
    </style>
  </head>
  <body>
    <article class="estimate-card">
      <div class="brand">
        ${logoDataUri ? `<img src="${logoDataUri}" alt="Company Logo" />` : ""}
        <div><h1>${escapeHtml(content.title || "Project Estimate")}</h1></div>
      </div>
      <p class="intro">${escapeHtml(content.intro || "")}</p>
      ${sectionHtml}
    </article>
  </body>
</html>`;
}
