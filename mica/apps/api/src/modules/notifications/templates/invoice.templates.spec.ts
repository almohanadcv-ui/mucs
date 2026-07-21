import { invoiceDecidedEmail, invoiceSubmittedEmail } from "./invoice.templates";

const base = {
  invoiceId: "clx000000000000invoice1",
  invoiceNumber: "INV-2026-000042",
  amount: "1500.00",
  plateNumber: "ABC-1234",
  vehicleName: "تويوتا هايلكس",
  submittedAt: new Date("2026-07-21T09:00:00Z"),
  publicUrl: "https://mica.example.com",
};

describe("invoice email templates", () => {
  describe("submitted", () => {
    const mail = invoiceSubmittedEmail({ ...base, workshopName: "ورشة النخبة", submittedBy: "أحمد" });

    it("tags the subject so recipients can filter on it", () => {
      expect(mail.subject.startsWith("[MICA] ")).toBe(true);
    });

    it("carries the details a manager needs to decide", () => {
      for (const detail of ["ABC-1234", "1,500.00", "ورشة النخبة", "أحمد"]) {
        expect(mail.html).toContain(detail);
        expect(mail.text).toContain(detail);
      }
    });

    it("ships a plain-text part alongside the HTML", () => {
      // Mail with an HTML part only scores worse with spam filters.
      expect(mail.text.length).toBeGreaterThan(0);
      expect(mail.text).not.toContain("<");
    });

    it("links into MICA rather than carrying the decision in the URL", () => {
      // A link that acts on being followed would fire on mail scanners and
      // link previews, deciding an invoice nobody clicked.
      expect(mail.html).toContain("https://mica.example.com/invoices");
      expect(mail.html).not.toMatch(/action=(approve|reject)/);
    });

    it("renders right-to-left", () => {
      expect(mail.html).toContain('dir="rtl"');
    });

    it("references the logo by CID, never as a remote URL", () => {
      // A hosted image is blocked until the reader clicks "download pictures",
      // so the branding would be a broken box on first open.
      expect(mail.html).toContain('src="cid:mab-logo"');
      expect(mail.html).not.toMatch(/<img[^>]+src="https?:/);
      expect(mail.html).not.toMatch(/<img[^>]+src="data:/);
    });

    it("carries an alt text so the header reads with images off", () => {
      expect(mail.html).toMatch(/<img[^>]+alt="MAB"/);
    });

    it("uses the brand blue taken from the wordmark", () => {
      expect(mail.html).toContain("#1b76bd");
    });

    it("shows the real invoice number, not a slice of the internal id", () => {
      expect(mail.html).toContain("INV-2026-000042");
      expect(mail.html).not.toContain("INVOICE1");
    });

    it("uses Latin digits everywhere", () => {
      // Eastern Arabic numerals in the date beside Latin ones in the amount
      // made a column of invoices unreadable.
      expect(mail.text).not.toMatch(/[٠-٩]/);
      expect(mail.html).not.toMatch(/[٠-٩]/);
    });

    it("writes the date in a fixed, orderly form", () => {
      // 09:00 UTC is noon in Riyadh.
      expect(mail.text).toContain("21/07/2026 — 12:00");
    });

    it("formats the amount with thousands separators", () => {
      const big = invoiceSubmittedEmail({ ...base, amount: "4850" });
      expect(big.text).toContain("4,850.00 ر.س");
    });

    it("omits optional fields instead of printing empty rows", () => {
      const minimal = invoiceSubmittedEmail(base);
      expect(minimal.html).not.toContain("الورشة");
      expect(minimal.html).not.toContain("رفعها");
    });
  });

  describe("decided", () => {
    it("puts the rejection reason in its own field", () => {
      const mail = invoiceDecidedEmail({
        ...base,
        outcome: "rejected",
        decidedAt: new Date("2026-07-21T10:00:00Z"),
        decidedBy: "سالم",
        rejectionReason: "المبلغ غير مطابق للعرض",
      });

      expect(mail.subject).toContain("رفض");
      expect(mail.html).toContain("سبب الرفض");
      expect(mail.html).toContain("المبلغ غير مطابق للعرض");
    });

    it("does not show a rejection field on an acceptance", () => {
      const mail = invoiceDecidedEmail({
        ...base,
        outcome: "accepted",
        decidedAt: new Date("2026-07-21T10:00:00Z"),
        decidedBy: "سالم",
      });

      expect(mail.subject).toContain("اعتماد");
      expect(mail.html).not.toContain("سبب الرفض");
    });

    it("escapes markup typed into the rejection reason", () => {
      const mail = invoiceDecidedEmail({
        ...base,
        outcome: "rejected",
        decidedAt: new Date("2026-07-21T10:00:00Z"),
        rejectionReason: '<img src=x onerror="alert(1)">',
      });

      // The layout has a legitimate <img> for the logo, so the assertion is on
      // the payload: the only <img> tag in the document is the logo's, and the
      // injected one survives as inert text. ("onerror=" still appears in that
      // text — the equals sign needs no escaping — which is exactly why the
      // check is on the tag delimiters, not on the attribute name.)
      const imgTags = mail.html.match(/<img[^>]*>/g) ?? [];
      expect(imgTags).toHaveLength(1);
      expect(imgTags[0]).toContain("cid:mab-logo");
      expect(mail.html).toContain("&lt;img src=x");
    });
  });
});
