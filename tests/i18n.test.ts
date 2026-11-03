import { describe, expect, it } from "vitest";
import { localizeError, setActiveLocale, t, translate } from "@/lib/i18n";

describe("locale", () => {
  it("keeps English by default and switches the active language", () => {
    setActiveLocale("en");
    expect(t("nav.home")).toBe("Dashboard");
    setActiveLocale("zh");
    expect(t("nav.home")).toBe("首页");
    expect(t("time.minutes", { n: 3 })).toBe("3 分钟前");
    setActiveLocale("en");
  });

  it("translates known file errors and leaves other messages alone", () => {
    const english = translate("en", "pdf.noText");
    expect(localizeError("zh", english)).toContain("扫描版");
    expect(localizeError("en", english)).toBe(english);
    expect(localizeError("zh", "Claude Code exited with code 1")).toBe("Claude Code exited with code 1");
  });
});
