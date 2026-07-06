import Link from "next/link";
import {
  ShieldCheck,
  BarChart3,
  Users,
  ClipboardCheck,
  Star,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MabLogo } from "@/components/mab-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

const features = [
  {
    icon: ClipboardCheck,
    title: "نماذج تقييم لا نهائية",
    desc: "أنشئ نماذج تقييم شهرية وسنوية وأداء بأنواع أسئلة متعددة.",
  },
  {
    icon: Star,
    title: "١١ نوع سؤال",
    desc: "تقييم نجمي، اختيارات، نص، رقم، تاريخ، رفع ملفات والمزيد.",
  },
  {
    icon: BarChart3,
    title: "لوحات معلومات غنية",
    desc: "إحصائيات ورسوم بيانية لحظية لكل قسم وفرع ومقيّم.",
  },
  {
    icon: Users,
    title: "أدوار وصلاحيات",
    desc: "مدير، مشرف، مقيّم — تحكم دقيق قائم على الصلاحيات (RBAC).",
  },
  {
    icon: ShieldCheck,
    title: "حماية بمعايير OWASP",
    desc: "تشفير، 2FA، سجل عمليات كامل، حماية من الهجمات الشائعة.",
  },
  {
    icon: Lock,
    title: "جاهز للتوسع (SaaS)",
    desc: "بنية Multi-tenant منذ اليوم الأول دون إعادة كتابة النظام.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/30">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <MabLogo className="h-8 w-auto" />
          <span className="text-lg font-bold">EMS</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button asChild variant="ghost">
            <Link href="/login">تسجيل الدخول</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">لوحة المعلومات</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-20 text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm text-muted-foreground">
            <span className="size-2 rounded-full bg-success" />
            نظام إدارة تقييم بمستوى منتجات SaaS العالمية
          </div>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            نظام إدارة تقييم الموظفين والمتدربين
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground">
            منصّة احترافية لإدارة التقييمات وأداء الفريق — واجهات عربية RTL كاملة،
            لوحات معلومات غنية، وأعلى معايير الأمان.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/dashboard">ابدأ الآن</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-5 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <f.icon className="size-5" />
                </div>
                <CardTitle>{f.title}</CardTitle>
                <CardDescription>{f.desc}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          ))}
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} EMS — نظام إدارة التقييم. جميع الحقوق محفوظة.
      </footer>
    </div>
  );
}
