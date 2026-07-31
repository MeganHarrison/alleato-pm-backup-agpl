import fs from "node:fs";
import path from "node:path";

import { chromium } from "../../frontend/node_modules/playwright/index.mjs";

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  throw new Error("Usage: node render-docx-preview.mjs <input.docx> <output-dir>");
}

const inputPath = path.resolve(inputArg);
const outputDir = path.resolve(outputArg);
const previewScript = path.resolve(
  "frontend/node_modules/docx-preview/dist/docx-preview.js",
);
const zipScript = path.resolve("frontend/node_modules/jszip/dist/jszip.min.js");
const installedChromium = path.join(
  process.env.LOCALAPPDATA ?? "",
  "ms-playwright",
  "chromium-1208",
  "chrome-win64",
  "chrome.exe",
);
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  ...(fs.existsSync(installedChromium)
    ? { executablePath: installedChromium }
    : {}),
});
try {
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1000 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    "<!doctype html><html><head><meta charset='utf-8'><style>body{margin:0;background:#d8d8d8}.docx-wrapper{padding:24px!important}</style></head><body><main id='document'></main></body></html>",
  );
  await page.addScriptTag({ path: zipScript });
  await page.addScriptTag({ path: previewScript });
  const encoded = fs.readFileSync(inputPath).toString("base64");
  await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) =>
      character.charCodeAt(0),
    );
    await window.docx.renderAsync(bytes.buffer, document.querySelector("#document"), null, {
      breakPages: true,
      renderHeaders: true,
      renderFooters: true,
      useBase64URL: true,
    });
  }, encoded);

  const pages = page.locator(".docx-wrapper > section.docx");
  const count = await pages.count();
  if (!count) throw new Error("DOCX preview produced no pages.");
  for (let index = 0; index < count; index += 1) {
    await pages.nth(index).screenshot({
      path: path.join(outputDir, `page-${index + 1}.png`),
    });
  }
  process.stdout.write(`Rendered ${count} page(s) to ${outputDir}\n`);
} finally {
  await browser.close();
}
