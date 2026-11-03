import JSZip from "jszip";
import { JSDOM } from "jsdom";

export interface ExtractedEpub {
  title: string;
  content: string;
}

const HTML_TYPES = new Set([
  "application/xhtml+xml",
  "application/xml",
  "text/html",
  "text/xml",
]);

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .trim();
}

function attr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match?.[1] ?? "";
}

function resolveZipPath(baseDir: string, href: string): string {
  const clean = decodeURIComponent(href.split("#")[0]).replace(/\\/g, "/");
  const parts = baseDir.split("/").filter(Boolean);
  for (const part of clean.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function xhtmlToMarkdown(html: string): string {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  doc.querySelectorAll("script, style").forEach((node) => node.remove());
  const root = doc.body ?? doc.documentElement;
  if (!root) return "";

  const parts: string[] = [];
  root.querySelectorAll("h1, h2, h3, h4, p, li").forEach((el) => {
    if (el.tagName.toLowerCase() === "li" && el.querySelector("p")) return;
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) return;
    const tag = el.tagName.toLowerCase();
    if (tag === "h1") parts.push(`# ${text}`);
    else if (tag === "h2") parts.push(`## ${text}`);
    else if (tag === "h3") parts.push(`### ${text}`);
    else if (tag === "h4") parts.push(`#### ${text}`);
    else if (tag === "li") parts.push(`- ${text}`);
    else parts.push(text);
  });

  return parts.join("\n\n");
}

/**
 * A long book cannot fit in one analysis prompt. Keep the opening, a middle
 * slice, and the ending so the verdict is not based only on the preface.
 */
export function sampleLongText(
  text: string,
  limit = 18000,
  markers?: { middle: string; end: string }
): string {
  if (text.length <= limit) return text;
  const head = Math.floor(limit * 0.5);
  const mid = Math.floor(limit * 0.25);
  const tail = limit - head - mid;
  const midStart = Math.max(head, Math.floor(text.length / 2) - Math.floor(mid / 2));
  return [
    text.slice(0, head),
    markers?.middle ?? "\n\n[...middle omitted. Excerpt from the middle...]\n\n",
    text.slice(midStart, midStart + mid),
    markers?.end ?? "\n\n[...excerpt from the end...]\n\n",
    text.slice(-tail),
  ].join("");
}

export async function extractEpub(data: Buffer | Uint8Array): Promise<ExtractedEpub> {
  const zip = await JSZip.loadAsync(data);
  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) {
    throw new Error("This EPUB is missing META-INF/container.xml");
  }

  const container = await containerFile.async("string");
  const rootPath = container.match(/full-path\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!rootPath) {
    throw new Error("This EPUB does not name its package file");
  }

  const opfPath = decodeURIComponent(rootPath).replace(/\\/g, "/");
  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error("This EPUB's package file is missing");
  }

  const opf = await opfFile.async("string");
  const title = decodeXml(opf.match(/<(?:[\w-]+:)?title[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?title>/i)?.[1] ?? "");
  const baseDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/")) : "";

  const manifest = new Map<string, { href: string; mediaType: string }>();
  for (const tag of opf.match(/<item\b[^>]*>/gi) ?? []) {
    const id = attr(tag, "id");
    const href = attr(tag, "href");
    if (!id || !href) continue;
    manifest.set(id, { href, mediaType: attr(tag, "media-type").toLowerCase() });
  }

  const spineIds = [...opf.matchAll(/<itemref\b[^>]*>/gi)]
    .map((match) => attr(match[0], "idref"))
    .filter(Boolean);

  const chapters = spineIds
    .map((id) => manifest.get(id))
    .filter((item): item is { href: string; mediaType: string } => {
      if (!item) return false;
      if (item.mediaType && HTML_TYPES.has(item.mediaType)) return true;
      return /\.(xhtml|html|htm)$/i.test(item.href);
    });

  const pages = chapters.length > 0
    ? chapters
    : [...manifest.values()].filter((item) => /\.(xhtml|html|htm)$/i.test(item.href));

  const sections: string[] = [];
  for (const page of pages) {
    const file = zip.file(resolveZipPath(baseDir, page.href));
    if (!file) continue;
    const html = await file.async("string");
    const markdown = xhtmlToMarkdown(html);
    if (markdown) sections.push(markdown);
  }

  const content = sections.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!content) {
    throw new Error("This EPUB has no readable text");
  }

  return { title, content };
}
