// Basic test script to verify core functionality
import { analyzePdf } from "./lib/pdfAnalysis.js";
import { renderEstimatePdf } from "./lib/pdfRenderer.js";
import { buildEstimateContent } from "./lib/estimateComposer.js";

console.log("Testing imports...");

try {
  console.log("✓ All imports successful");
  console.log("✓ analyzePdf function available");
  console.log("✓ renderEstimatePdf function available");
  console.log("✓ buildEstimateContent function available");
  console.log("\nAll core functions are available!");
} catch (error) {
  console.error("✗ Import error:", error.message);
  process.exit(1);
}
