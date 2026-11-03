import { extractText, getMeta } from "unpdf";

export interface ExtractedPdf {
  title: string;
  content: string;
}

const MIN_TEXT_CHARS = 80;

export async function extractPdfText(data: Buffer | Uint8Array): Promise<ExtractedPdf> {
  const bytes = new Uint8Array(data);
  let text = "";
  try {
    const extracted = await extractText(bytes, { mergePages: true });
    text = extracted.text;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/password/i.test(message)) {
      throw new Error("This PDF is password-protected. Remove the password and upload it again.");
    }
    throw new Error("This PDF could not be read.");
  }

  const content = text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (content.replace(/\s/g, "").length < MIN_TEXT_CHARS) {
    throw new Error("This PDF has no selectable text. It is probably a scan. Use an EPUB, or a PDF with a text layer.");
  }

  let title = "";
  try {
    const meta = await getMeta(bytes);
    title = meta.info.Title?.trim() ?? "";
  } catch {
    title = "";
  }

  return { title, content };
}
