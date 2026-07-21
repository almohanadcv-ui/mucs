import { renderEmail, renderText, subject, type EmailContent } from "./layout";
import type { RenderedEmail } from "./invoice.templates";

function render(content: EmailContent, subjectText: string): RenderedEmail {
  return {
    subject: subject(subjectText),
    html: renderEmail(content),
    text: renderText(content),
  };
}

/**
 * The second factor for a sign-in already past the password.
 *
 * Carries no link at all. A sign-in code that arrives with a button is the
 * exact shape of a phishing mail, and training people to click those is worse
 * than the small friction of typing six digits.
 */
export function loginCodeEmail(data: {
  code: string;
  ipAddress?: string | null;
  minutes: number;
}): RenderedEmail {
  return render(
    {
      accent: "action",
      eyebrow: "رمز الدخول",
      heading: "أكمل تسجيل الدخول",
      intro: `اكتب هذا الرمز في صفحة الدخول. صالح لمدة ${data.minutes} دقائق.`,
      rows: [
        // Spaced so it can be read off a screen without losing place.
        { label: "الرمز", value: data.code.split("").join(" "), emphasis: true },
        ...(data.ipAddress ? [{ label: "من عنوان", value: data.ipAddress }] : []),
      ],
      callout: {
        label: "لم تطلب هذا؟",
        body: "شخص ما يعرف كلمة مرورك. غيّرها فورًا وأبلغ الدعم الفني.",
      },
      footnote: "لن يطلب منك أحد هذا الرمز — لا الدعم الفني ولا الإدارة. لا ترسله لأحد.",
    },
    "رمز تسجيل الدخول",
  );
}

/** Emailed to a user who asked to reset their own password. */
export function passwordResetEmail(data: {
  resetUrl: string;
  minutes: number;
  ipAddress?: string | null;
}): RenderedEmail {
  return render(
    {
      accent: "action",
      eyebrow: "استعادة الوصول",
      heading: "تعيين كلمة مرور جديدة",
      intro: `اضغط الزر لاختيار كلمة مرور جديدة. الرابط صالح ${data.minutes} دقيقة ولمرة واحدة.`,
      rows: data.ipAddress ? [{ label: "طُلب من عنوان", value: data.ipAddress }] : [],
      buttons: [{ label: "تعيين كلمة المرور", url: data.resetUrl, kind: "primary" }],
      callout: {
        label: "لم تطلب هذا؟",
        body: "تجاهل الرسالة — كلمة مرورك الحالية تبقى كما هي ولم يتغيّر شيء.",
      },
    },
    "استعادة كلمة المرور",
  );
}
