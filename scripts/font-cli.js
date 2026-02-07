import "dotenv/config";
import {
  installFamilyToSystemFonts,
  installFontFromGoogle,
  searchFonts
} from "../lib/fontManager.js";

const [, , command, ...args] = process.argv;

async function run() {
  if (command === "search") {
    const query = args.join(" ").trim();
    const results = await searchFonts(query);
    console.log(JSON.stringify({ query, count: results.length, results }, null, 2));
    return;
  }

  if (command === "install") {
    const family = args.join(" ").trim();
    if (!family) {
      throw new Error("Usage: npm run font:install -- \"Font Family\"");
    }
    const result = await installFontFromGoogle(family);
    console.log(
      JSON.stringify(
        {
          family: result.family,
          files: result.files.map((f) => ({
            path: f.filePath,
            format: f.format,
            verified: f.verification.ok,
            detectedFamily: f.verification.familyName
          }))
        },
        null,
        2
      )
    );
    return;
  }

  if (command === "install-system") {
    const family = args.join(" ").trim();
    if (!family) {
      throw new Error("Usage: npm run font:install-system -- \"Font Family\"");
    }
    const result = await installFamilyToSystemFonts(family);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  throw new Error(
    "Usage: npm run font:search -- <query> OR npm run font:install -- \"Font Family\" OR npm run font:install-system -- \"Font Family\""
  );
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
