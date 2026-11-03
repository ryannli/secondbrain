import { describe, expect, it } from "vitest";
import { extractPdfText } from "@/lib/pdf";
import { parseJsonResponse } from "@/lib/claude";

function buildPdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET\n`;
  const objects = [
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n",
    "2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n",
    "3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n",
    "4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n",
    `5 0 obj<</Length ${Buffer.byteLength(stream)}>>stream\n${stream}endstream\nendobj\n`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }
  const xrefAt = Buffer.byteLength(body);
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += xref;
  body += `trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefAt}\n%%EOF`;
  return Buffer.from(body);
}

describe("extractPdfText", () => {
  it("reads selectable text from a PDF", async () => {
    const sentence = "Probability is extended logic, not a frequency carved into the world. ";
    const extracted = await extractPdfText(buildPdf(sentence.repeat(3)));
    expect(extracted.content).toContain("Probability is extended logic");
  });

  it("rejects a PDF that has no text layer", async () => {
    const blank = buildPdf("");
    await expect(extractPdfText(blank)).rejects.toThrow("no selectable text");
  });
});

describe("parseJsonResponse", () => {
  it("repairs unescaped quotation marks inside a string", () => {
    const broken = `{
      "triage": { "reason": "把物理学的"不确定性"放回推断里", "action": "worth_reading" }
    }`;
    const parsed = parseJsonResponse(broken, "test");
    expect(parsed?.triage).toMatchObject({ action: "worth_reading" });
  });
});
