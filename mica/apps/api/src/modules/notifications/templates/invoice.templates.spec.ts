import { invoiceDecidedEmail, invoiceSubmittedEmail } from "./invoice.templates";

const base = {
  invoiceId: "clx000000000000invoice1",
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
      for (const detail of ["ABC-1234", "1500.00", "ورشة النخبة", "أحمد"]) {
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

      expect(mail.html).not.toContain("<img");
      expect(mail.html).toContain("&lt;img");
    });
  });
});
