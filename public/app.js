const form = document.querySelector("#gen-form");
const statusEl = document.querySelector("#status");
const styleEl = document.querySelector("#style-profile");
const preview = document.querySelector("#preview");
const downloadHtmlBtn = document.querySelector("#download-html");
const downloadPdfBtn = document.querySelector("#download-pdf");
const generateBtn = document.querySelector("#generate-btn");

const fontQueryInput = document.querySelector("#font-query");
const fontFamilyInput = document.querySelector("#font-family");
const fontSearchBtn = document.querySelector("#font-search-btn");
const fontInstallBtn = document.querySelector("#font-install-btn");
const fontOutput = document.querySelector("#font-output");

let generatedHtml = "";
let generatedPdfBase64 = "";
let generatedPdfName = "estimate.pdf";

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#334155";
}

function fileCountValid(input) {
  return input.files.length > 0 && input.files.length <= 10;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

fontSearchBtn.addEventListener("click", async () => {
  const q = fontQueryInput.value.trim();
  try {
    const response = await fetch(`/api/fonts/search?q=${encodeURIComponent(q)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Font search failed.");
    fontOutput.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    fontOutput.textContent = `Error: ${error.message || "Font search failed."}`;
  }
});

fontInstallBtn.addEventListener("click", async () => {
  const family = fontFamilyInput.value.trim();
  if (!family) {
    fontOutput.textContent = "Error: enter a font family to install.";
    return;
  }

  try {
    const response = await fetch("/api/fonts/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ family })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Font install failed.");
    fontOutput.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    fontOutput.textContent = `Error: ${error.message || "Font install failed."}`;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const pdfInput = document.querySelector("#pdfs");
  const logoInput = document.querySelector("#logo");
  const promptInput = document.querySelector("#prompt");

  if (!fileCountValid(pdfInput)) {
    setStatus("Please upload between 1 and 10 PDFs.", true);
    return;
  }

  if (!promptInput.value.trim()) {
    setStatus("Please describe the new client request.", true);
    return;
  }

  generateBtn.disabled = true;
  downloadHtmlBtn.disabled = true;
  downloadPdfBtn.disabled = true;
  setStatus("Analyzing files and generating estimate + PDF...");

  const formData = new FormData();
  for (const file of pdfInput.files) {
    formData.append("pdfs", file);
  }
  if (logoInput.files[0]) {
    formData.append("logo", logoInput.files[0]);
  }
  formData.append("prompt", promptInput.value.trim());

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");

    styleEl.textContent = JSON.stringify(data.styleProfile, null, 2);
    preview.srcdoc = data.html;

    generatedHtml = data.html;
    generatedPdfBase64 = data.pdfBase64;
    generatedPdfName = data.pdfFileName || "estimate.pdf";

    downloadHtmlBtn.disabled = false;
    downloadPdfBtn.disabled = false;

    const engine = data.llmConfigured ? "local model" : "fallback template";
    setStatus(`Generated successfully using ${engine}. PDF font: ${data.pdfFont}.`);
  } catch (error) {
    setStatus(error.message || "Unable to generate estimate.", true);
  } finally {
    generateBtn.disabled = false;
  }
});

downloadHtmlBtn.addEventListener("click", () => {
  if (!generatedHtml) return;
  downloadBlob(new Blob([generatedHtml], { type: "text/html" }), "estimate.html");
});

downloadPdfBtn.addEventListener("click", () => {
  if (!generatedPdfBase64) return;
  const binary = atob(generatedPdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  downloadBlob(new Blob([bytes], { type: "application/pdf" }), generatedPdfName);
});
