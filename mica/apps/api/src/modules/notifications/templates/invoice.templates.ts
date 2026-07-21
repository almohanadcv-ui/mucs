import { renderEmail, renderText, subject, type EmailContent } from "./layout";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface InvoiceEmailData {
  invoiceId: string;
  invoiceNumber?: string | null;
  amount: string;
  plateNumber: string;
  vehicleName?: string | null;
  workshopName?: string | null;
  submittedBy?: string | null;
  submittedAt: Date;
  publicUrl: string;
}

const money = (amount: string) => `${amount} ر.س`;

const date = (d: Date) =>
  new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  }).format(d);

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
    { label: "رقم الفاتورة", value: data.invoiceNumber || data.invoiceId.slice(-8).toUpperCase() },
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
    { label: "رقم الفاتورة", value: data.invoiceNumber || data.invoiceId.slice(-8).toUpperCase() },
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
