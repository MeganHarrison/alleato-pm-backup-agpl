import fs from "node:fs/promises";
import syncFs from "node:fs";
import { chromium } from "playwright";

const [htmlPath, optionsPath, outputPath] = process.argv.slice(2);

if (!htmlPath || !optionsPath || !outputPath) {
  throw new Error("Usage: node render-pdf.mjs <htmlPath> <optionsPath> <outputPath>");
}

const html = await fs.readFile(htmlPath, "utf8");
const options = JSON.parse(await fs.readFile(optionsPath, "utf8"));

const localPaths = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);
const executablePath = localPaths.find((candidate) => syncFs.existsSync(candidate));

if (!executablePath) {
  throw new Error(
    "PDF generation requires a local Chrome executable. Set PUPPETEER_EXECUTABLE_PATH or install Google Chrome.",
  );
}

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.setContent(html, { waitUntil: "networkidle" });

  await page.evaluate(async () => {
    const pendingImages = Array.from(document.images).filter((image) => !image.complete);
    await Promise.all(
      pendingImages.map(
        (image) =>
          new Promise((resolve) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          }),
      ),
    );
  });

  const pdf = await page.pdf({
    format: "Letter",
    landscape: Boolean(options.landscape),
    printBackground: true,
    displayHeaderFooter: Boolean(options.footerTemplate),
    headerTemplate: "<div></div>",
    footerTemplate: options.footerTemplate ?? "<div></div>",
    margin: {
      top: "0.5in",
      right: "0.5in",
      bottom: options.marginBottom ?? "0.5in",
      left: "0.5in",
    },
  });

  await fs.writeFile(outputPath, pdf);
} finally {
  await browser.close();
}
