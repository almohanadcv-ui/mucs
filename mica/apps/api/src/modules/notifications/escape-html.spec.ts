import { escapeHtml } from "./escape-html";

describe("escapeHtml", () => {
  it("neutralises markup in user-supplied text", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("escapes the ampersand once, not twice", () => {
    // Replacing & after the other entities would turn "&lt;" into "&amp;lt;"
    // and the recipient would read the escape sequence instead of the text.
    expect(escapeHtml("<a & b>")).toBe("&lt;a &amp; b&gt;");
  });

  it("escapes quotes so text cannot break out of an attribute", () => {
    expect(escapeHtml(`" onload="x`)).toBe("&quot; onload=&quot;x");
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("leaves Arabic text untouched", () => {
    expect(escapeHtml("فاتورة المركبة مرفوضة")).toBe("فاتورة المركبة مرفوضة");
  });

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });
});
