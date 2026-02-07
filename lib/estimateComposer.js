function fallbackSections(prompt) {
  const lines = String(prompt || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const summary = lines[0] || "Custom estimate request";
  const scope = lines.slice(1, 8);

  // Try to extract title from prompt
  let title = "Project Estimate";
  const titleMatch = prompt.match(/^(?:title|project|estimate)[:\s]+(.+?)(?:\n|$)/i);
  if (titleMatch) {
    title = titleMatch[1].trim();
  } else if (summary.length < 60) {
    title = summary;
  }

  // Extract sections from prompt if structured
  const sections = [];
  let currentSection = null;
  
  for (const line of lines) {
    // Check if line looks like a section heading
    if (line.match(/^(?:##?|section|heading|deliverable|scope|pricing|timeline|terms?)[:\s]/i)) {
      if (currentSection && currentSection.bullets.length > 0) {
        sections.push(currentSection);
      }
      const heading = line.replace(/^(?:##?\s*|(?:section|heading|deliverable|scope|pricing|timeline|terms?)[:\s]+)/i, "").trim();
      currentSection = { heading: heading || "Section", bullets: [] };
    } else if (line.match(/^[-•*]\s/) && currentSection) {
      // Bullet point
      currentSection.bullets.push(line.replace(/^[-•*]\s+/, "").trim());
    } else if (currentSection && line.length > 10) {
      // Regular content line
      currentSection.bullets.push(line);
    }
  }
  
  if (currentSection && currentSection.bullets.length > 0) {
    sections.push(currentSection);
  }

  // If no structured sections found, create default ones
  if (sections.length === 0) {
    sections.push(
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
    );
  }

  return {
    title,
    intro: summary,
    sections
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
      boldRatio: styleProfile.emphasis?.boldRatio,
      colors: styleProfile.colors?.slice(0, 3)
    },
    null,
    2
  );

  // Truncate source text if too long
  const truncatedSource = sourceText ? sourceText.slice(0, 8000) : "";

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.LLM_API_KEY ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` } : {})
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an expert at creating professional project estimates. 
Analyze the client request and reference documents to create a structured estimate.
Return ONLY valid JSON with this exact structure:
{
  "title": "Project Title",
  "intro": "Brief introduction paragraph",
  "sections": [
    {"heading": "Section Name", "bullets": ["Item 1", "Item 2"]}
  ]
}
Ensure all sections have meaningful headings and 2-6 bullet points each.`
          },
          {
            role: "user",
            content: `Create a professional estimate based on this client request:

${prompt}

Style profile from reference documents:
${styleHint}

Reference text from similar documents (for style and tone):
${truncatedSource}

Generate a comprehensive estimate that matches the style and structure of the reference documents.`
          }
        ]
      }),
      signal: AbortSignal.timeout(60000) // 60 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.warn(`LLM API error (${response.status}):`, errorText);
      return null;
    }

    const json = await response.json();
    const raw = json?.choices?.[0]?.message?.content;
    if (!raw) return null;

    // Try to extract JSON if wrapped in markdown code blocks
    let jsonText = raw;
    const jsonMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    try {
      const parsed = JSON.parse(jsonText);
      // Validate structure
      if (!parsed || typeof parsed !== "object") return null;
      if (!parsed.sections || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
        return null;
      }
      // Ensure all sections have required fields
      parsed.sections = parsed.sections
        .filter(s => s && s.heading && Array.isArray(s.bullets) && s.bullets.length > 0)
        .map(s => ({
          heading: String(s.heading || "Section").trim(),
          bullets: s.bullets.map(b => String(b || "").trim()).filter(b => b.length > 0)
        }));
      
      if (parsed.sections.length === 0) return null;
      
      return {
        title: String(parsed.title || "Project Estimate").trim(),
        intro: String(parsed.intro || "").trim(),
        sections: parsed.sections
      };
    } catch (parseError) {
      console.warn("Failed to parse LLM JSON response:", parseError.message);
      return null;
    }
  } catch (error) {
    if (error.name === "AbortError") {
      console.warn("LLM request timed out");
    } else {
      console.warn("LLM request failed:", error.message);
    }
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
