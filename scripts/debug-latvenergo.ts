import { extractPdfText } from "../src/lib/pdf";
import {
  buildUtilityLineItemsFromText,
  parseAddressBlocksFromLines,
  summarizeAddressBlocks,
} from "../src/lib/utilityBillHeuristic";
import { normalizeMatchText } from "../src/lib/lineItems";

const pdfs = [
  {
    path: "/Users/tfedorko/Library/Application Support/Cursor/User/workspaceStorage/dae5ab1ae5ed816a143293e1c296eb60/pdfs/de1aa63a-7278-4328-9dc3-83b75a45f76f/Rekins_303922371607.pdf",
    expectedNet: 22.4,
    expectedTotal: 27.1,
  },
  {
    path: "/Users/tfedorko/Library/Application Support/Cursor/User/workspaceStorage/dae5ab1ae5ed816a143293e1c296eb60/pdfs/a93d385d-a9cb-4e6f-be43-1de1878f1fb7/Rekins_303888551937.pdf",
    expectedNet: 27.18,
    expectedTotal: 32.88,
  },
];

// Common profile identifiers — adjust after inspecting PDF text.
const identifiers = [
  "Ieriku iela 58-52",
  "58-52",
  "5105143425",
];

async function main() {
  for (const pdf of pdfs) {
    const name = pdf.path.split("/").pop();
    console.log(`\n==== ${name} (expect net ${pdf.expectedNet}, total ${pdf.expectedTotal}) ====`);

    const { text, pageCount } = await extractPdfText(pdf.path);
    console.log("pages", pageCount, "chars", text.length);

    const blocks = parseAddressBlocksFromLines(text);
    console.log("blocks", blocks.length, summarizeAddressBlocks(blocks));
    for (const b of blocks) {
      console.log(
        ` block ${b.index} total=${b.totalDisplay} addr=${b.addressLabel?.slice(0, 80)} amounts=${JSON.stringify(b.amounts)}`,
      );
    }

    const kopas = [...text.matchAll(/Kop[aā][^\n]{0,40}(\d+[.,]\d{2})/gi)].map((m) => m[1]);
    console.log("kopa-like:", [...new Set(kopas)]);

    for (const needle of ["22,40", "27,18", "49,36", "31,74", "22.40", "27.18"]) {
      const i = text.indexOf(needle);
      if (i >= 0) {
        console.log(
          needle,
          ":",
          text.slice(Math.max(0, i - 100), i + 60).replace(/\n/g, " | "),
        );
      }
    }

    const items = buildUtilityLineItemsFromText(
      text,
      identifiers,
      'AS "Latvenergo"',
      null,
    );
    console.log("heuristic items:", JSON.stringify(items, null, 2));
  }
}

main().catch(console.error);
