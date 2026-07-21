import { renderEmail, renderText, subject, type EmailContent } from "./layout";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface InvoiceEmailData {
  invoiceId: string;
  invoiceNumber: string;
  amount: string;
  plateNumber: string;
  vehicleName?: string | null;
  workshopName?: string | null;
  submittedBy?: string | null;
  submittedAt: Date;
  publicUrl: string;
}

/**
 * Latin digits throughout, and a fixed Gregorian calendar.
 *
 * `ar-SA` alone would render Eastern Arabic numerals and, on some ICU builds,
 * the Hijri calendar — so the same invoice could show a different date
 * depending on where the API happens to run. Pinning the numbering system and
 * the calendar makes the output identical everywhere and keeps amounts and
 * dates in the same digits, which is what makes a column of them scannable.
 */
const LATIN = "ar-SA-u-nu-latn-ca-gregory";

const money = (amount: string) =>
  `${new Intl.NumberFormat(LATIN, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(amount.replace(/,/g, "")),
  )} ر.س`;

const date = (d: Date) => {
  const parts = new Intl.DateTimeFormat(LATIN, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Riyadh",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // Assembled by hand rather than trusting the locale's own ordering, which
  // inserts RTL marks that turn "21/07/2026" into a jumble in a mail client.
  return `${get("day")}/${get("month")}/${get("year")} — ${get("hour")}:${get("minute")}`;
};

function render(content: EmailContent, subjectText: string): RenderedEmail {
  return {
    subject: subject(subjectText),
    html: renderEmail(content),
    text: renderText(content),
  };
}

/**
 * Sent to everyone who may approve invoices, when a mechanic uploads one.
 *
 * The buttons link into MICA rather than carrying the decision themselves: a
 * link that acts on being followed would be triggered by mail scanners and
 * link previews, and would decide an invoice nobody clicked.
 */
export function invoiceSubmittedEmail(data: InvoiceEmailData): RenderedEmail {
  const rows = [
    { label: "رقم الفاتورة", value: data.invoiceNumber },
    { label: "المركبة", value: data.vehicleName ? `${data.plateNumber} — ${data.vehicleName}` : data.plateNumber },
    { label: "المبلغ", value: money(data.amount) },
    ...(data.workshopName ? [{ label: "الورشة", value: data.workshopName }] : []),
    ...(data.submittedBy ? [{ label: "رفعها", value: data.submittedBy }] : []),
    { label: "تاريخ الرفع", value: date(data.submittedAt) },
  ];

  return render(
    {
      heading: "فاتورة جديدة بانتظار الاعتماد",
      intro: "رُفعت فاتورة صيانة وتحتاج قرارك بالاعتماد أو الرفض.",
      rows,
      buttons: [{ label: "مراجعة الفاتورة", url: `${data.publicUrl}/invoices`, primary: true }],
      footnote: "الاعتماد والرفض يتمّان داخل النظام بعد تسجيل الدخول.",
    },
    "فاتورة جديدة بانتظار الاعتماد",
  );
}

/** Sent to the mechanic who uploaded the invoice, once a manager decides. */
export function invoiceDecidedEmail(
  data: InvoiceEmailData & {
    outcome: "accepted" | "rejected";
    decidedBy?: string | null;
    decidedAt: Date;
    rejectionReason?: string | null;
  },
): RenderedEmail {
  const accepted = data.outcome === "accepted";
  const heading = accepted ? "تم اعتماد فاتورتك" : "تم رفض فاتورتك";

  const rows = [
    { label: "رقم الفاتورة", value: data.invoiceNumber },
    { label: "المركبة", value: data.plateNumber },
    { label: "المبلغ", value: money(data.amount) },
    ...(data.decidedBy ? [{ label: accepted ? "اعتمدها" : "رفضها", value: data.decidedBy }] : []),
    { label: "وقت القرار", value: date(data.decidedAt) },
    // The reason is the whole point of a rejection email, so it is a field of
    // its own rather than a sentence buried in the intro.
    ...(!accepted && data.rejectionReason
      ? [{ label: "سبب الرفض", value: data.rejectionReason }]
      : []),
  ];

  return render(
    {
      heading,
      intro: accepted
        ? "اعتُمدت الفاتورة ولا يلزمك أي إجراء."
        : "رُفضت الفاتورة. راجع السبب وأعد الرفع بعد التصحيح.",
      rows,
      buttons: [{ label: "عرض الفاتورة", url: `${data.publicUrl}/invoices`, primary: true }],
    },
    heading,
  );
}
