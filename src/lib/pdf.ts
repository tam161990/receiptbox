import { readFile } from "node:fs/promises";
import path from "node:path";

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  hasTextLayer: boolean;
}

const MAX_PAGES = 10;
const MAX_CHARS = 40_000;

/** Pages with address breakdown (Enefit page 2, Elektrum detail) must not be truncated away. */
const UTILITY_PAGE_HINT =
  /piesl[eē]guma|kopa\s+ar\s+pvn|enefit|elektroenerg|sadales\s+sist[eē]mas/i;

// Module specifiers for pdfjs-dist that we want to keep dynamic so that the
// Next.js webpack pass does not try to statically resolve them at build time.
// Using runtime-built strings prevents the bundler from rewriting these paths.
const PDFJS_BUILD_DIR = ["pdfjs-dist", "legacy", "build"].join("/");
const PDFJS_MAIN = `${PDFJS_BUILD_DIR}/pdf.mjs`;
const PDFJS_WORKER = `${PDFJS_BUILD_DIR}/pdf.worker.mjs`;

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

// Wrap dynamic import in a Function so webpack can't statically analyze
// the specifier. This bypasses Next's "ESM packages need to be imported"
// build error for `pdfjs-dist` worker files.
const dynamicImport = new Function(
  "specifier",
  "return import(specifier);",
) as (specifier: string) => Promise<PdfjsModule>;

let pdfjsModulePromise: Promise<PdfjsModule> | null = null;

async function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = (async () => {
      const workerPath = path.join(process.cwd(), "node_modules", PDFJS_WORKER);
      const mod = await dynamicImport(PDFJS_MAIN);
      mod.GlobalWorkerOptions.workerSrc = workerPath;
      return mod;
    })();
  }
  return pdfjsModulePromise;
}

/**
 * Extract text content from a PDF using pdfjs-dist (Mozilla PDF.js).
 *
 * Returns `hasTextLayer: false` when the PDF appears to be a scanned image
 * with no embedded text (typical for photographed receipts saved as PDF).
 */
export async function extractPdfText(filePath: string): Promise<PdfExtractionResult> {
  const buffer = await readFile(filePath);

  const pdfjs = await getPdfjs();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
  });

  const doc = await loadingTask.promise;
  const pageCount = doc.numPages;
  const pagesToRead = Math.min(pageCount, MAX_PAGES);

  const chunks: string[] = [];
  // Fair budget per page so page 2+ (address breakdown) is not dropped when page 1 is long.
  const perPageLimit = Math.max(2500, Math.floor(MAX_CHARS / Math.max(pagesToRead, 1)));

  for (let i = 1; i <= pagesToRead; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: unknown) => {
        if (typeof item === "object" && item !== null && "str" in item) {
          const v = (item as { str?: unknown }).str;
          return typeof v === "string" ? v : "";
        }
        return "";
      })
      .filter((s) => s.length > 0)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText) {
      const utilityPage = UTILITY_PAGE_HINT.test(pageText);
      const limit = utilityPage ? Math.max(perPageLimit, 12_000) : perPageLimit;
      const slice = pageText.length > limit ? pageText.slice(0, limit) + "…" : pageText;
      chunks.push(`--- Lapa ${i} ---\n${slice}`);
    }
  }

  await doc.destroy();

  const fullText = chunks.join("\n\n").slice(0, MAX_CHARS);
  const hasTextLayer = fullText.trim().length >= 20;

  return {
    text: fullText,
    pageCount,
    hasTextLayer,
  };
}
