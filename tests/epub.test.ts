import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { extractEpub, sampleLongText } from "@/lib/epub";

async function makeEpub(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?>
     <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
       <rootfiles>
         <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
       </rootfiles>
     </container>`
  );
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0"?>
     <package xmlns="http://www.idpf.org/2007/opf">
       <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
         <dc:title>测试之书</dc:title>
       </metadata>
       <manifest>
         <item id="c1" href="chap1.xhtml" media-type="application/xhtml+xml"/>
         <item id="c2" href="chap2.xhtml" media-type="application/xhtml+xml"/>
       </manifest>
       <spine>
         <itemref idref="c1"/>
         <itemref idref="c2"/>
       </spine>
     </package>`
  );
  zip.file(
    "OEBPS/chap1.xhtml",
    `<html><body><h1>第一章</h1><p>注意力仍然稀缺。</p></body></html>`
  );
  zip.file(
    "OEBPS/chap2.xhtml",
    `<html><body><h1>第二章</h1><p>判断留给自己。</p></body></html>`
  );
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

describe("extractEpub", () => {
  it("reads the title and chapters in spine order", async () => {
    const extracted = await extractEpub(await makeEpub());
    expect(extracted.title).toBe("测试之书");
    expect(extracted.content.indexOf("第一章")).toBeLessThan(extracted.content.indexOf("第二章"));
    expect(extracted.content).toContain("注意力仍然稀缺。");
    expect(extracted.content).toContain("判断留给自己。");
  });

  it("samples the opening, middle, and ending of a long book", () => {
    const text = `${"开头".repeat(100)}${"中段".repeat(400)}${"结尾".repeat(100)}`;
    const sample = sampleLongText(text, 120);
    expect(sample.startsWith("开头")).toBe(true);
    expect(sample).toContain("Excerpt from the middle");
    expect(sample.endsWith("结尾")).toBe(true);
    expect(sample.length).toBeLessThan(text.length);
  });
});
