import { useEffect } from "react";

export type SiteLanguage = "en" | "ar";

const arabic: Record<string, string> = {
  "Email notifications": "إشعارات البريد الإلكتروني",
  "Off — no notification emails will be sent to you.": "متوقفة — لن تُرسل إليك أي إشعارات على البريد.",
  "Send an email when a new task, approval, or reminder arrives for you.": "إرسال بريد عند وصول مهمة أو موافقة أو تذكير جديد لك.",
  "Add person": "إضافة شخص",
  "Team directory": "دليل الفريق",
  "All positions": "جميع المناصب",
  "All teams": "جميع الفرق",
  "Position": "المنصب",
  "Department & position": "القسم والمنصب",
  "Technical Department": "القسم الفني",
  "Technical Engineer": "مهندس فني",
  "Electrical Technical Office": "المكتب الفني الكهربائي",
  "Mechanical Technical Office": "المكتب الفني الميكانيكي",
  "Discipline": "التخصص",
  "Department structure": "هيكل الأقسام",
  "Both disciplines": "كلا التخصصين",
  "Add people & departments": "إضافة أشخاص وأقسام",
  "No people found": "لم يتم العثور على أشخاص",
  "Try another name or adjust your filters.": "جرّب اسماً آخر أو عدّل عوامل التصفية.",
  "Search name, email or position…": "ابحث بالاسم أو البريد الإلكتروني أو المنصب…",
  "Technical Manager": "المدير الفني",
  "Technical Management": "الإدارة الفنية",
  "Existing project (optional)": "مشروع موجود (اختياري)",
  "Assign to a project later": "الإضافة إلى مشروع لاحقاً",
  "Add normal users to this project": "إضافة مستخدمين إلى هذا المشروع",
  "Add selected people": "إضافة الأشخاص المحددين",
  "People added to the existing project.": "تمت إضافة الأشخاص إلى المشروع الموجود.",
  "Requires admin approval?": "هل يتطلب اعتماد المشرف؟",
  "Yes, request approval": "نعم، اطلب الاعتماد",
  "No, apply now": "لا، نفذ الآن",
  "Approve request": "اعتماد الطلب",
  "Reject request": "رفض الطلب",
  "Approve task": "اعتماد المهمة",
  "Finish task": "إنهاء المهمة",
  "Yes sends a request to your department admin only and waits for approval. No applies the action immediately.": "نعم يرسل طلباً إلى مشرف قسمك فقط وينتظر الاعتماد. لا ينفذ الإجراء فوراً.",
  "Team Leader": "قائد الفريق",
  "Request allocation": "طلب توزيع المهمة",
  "Send for admin approval": "إرسال لاعتماد المشرف",
  "Approve allocation": "اعتماد التوزيع",
  "Reject allocation": "رفض التوزيع",
  "Allocation pending": "التوزيع قيد الاعتماد",
  "Allocation rejected": "تم رفض التوزيع",
  "Allocation awaiting admin approval": "التوزيع بانتظار اعتماد المشرف",
  "Waiting for allocation approval": "بانتظار اعتماد التوزيع",
  "Waiting for team leader approval": "بانتظار اعتماد قائد الفريق",
  "Waiting for final admin approval": "بانتظار الاعتماد النهائي من المشرف",
  "Approve for admin review": "اعتماد وإرسال للمشرف",
  "Final approval": "الاعتماد النهائي",
  "Task Allocator": "نظام توزيع المهام",
  "Change language": "تغيير اللغة",
  "Command Center": "مركز القيادة",
  "Dashboard": "لوحة التحكم",
  "Active Tasks": "المهام النشطة",
  "My TODOs": "مهامي اليومية",
  "Projects": "المشاريع",
  "Finished Tasks": "المهام المكتملة",
  "Achievements": "الإنجازات",
  "Attendance": "الحضور",
  "People": "الأشخاص",
  "People Directory": "دليل الموظفين",
  "Team": "الفريق",
  "Team Performance": "أداء الفريق",
  "Productivity": "الإنتاجية",
  "Main navigation": "التنقل الرئيسي",
  "Current department": "القسم الحالي",
  "Super Admin": "المشرف العام",
  "Admin": "المشرف",
  "Normal User": "مستخدم",
  "New Task": "مهمة جديدة",
  "Messages": "الرسائل",
  "Close messages": "إغلاق الرسائل",
  "Department & direct chat": "محادثات القسم والمحادثات المباشرة",
  "Department": "القسم",
  "Groups": "المجموعات",
  "Direct Messages": "الرسائل المباشرة",
  "Create Group": "إنشاء مجموعة",
  "AI Assistant": "المساعد الذكي",
  "MAB AI Assistant": "مساعد MAB الذكي",
  "Write a message": "اكتب رسالة",
  "Send": "إرسال",
  "Sending…": "جارٍ الإرسال…",
  "Uploading…": "جارٍ الرفع…",
  "Reply": "رد",
  "Edit": "تعديل",
  "Delete": "حذف",
  "Save": "حفظ",
  "Cancel": "إلغاء",
  "This message was deleted": "تم حذف هذه الرسالة",
  "Delete message?": "حذف الرسالة؟",
  "Delete for me": "حذف لدي",
  "Delete for everyone": "حذف لدى الجميع",
  "Other people will still see this message.": "سيستمر الآخرون في رؤية هذه الرسالة.",
  "A deleted-message notice will remain.": "ستبقى إشارة تفيد بحذف الرسالة.",
  "Notifications": "الإشعارات",
  "Open": "فتح",
  "Logout": "تسجيل الخروج",
  "Light mode": "الوضع الفاتح",
  "Dark mode": "الوضع الداكن",
  "Quick Actions": "إجراءات سريعة",
  "Shortcuts": "اختصارات",
  "New task": "مهمة جديدة",
  "Free tasks": "المهام المتاحة",
  "Operations": "العمليات",
  "At a glance": "نظرة سريعة",
  "Team members": "أعضاء الفريق",
  "Urgent tasks": "المهام العاجلة",
  "Completed tasks": "المهام المكتملة",
  "Needs Review": "تحتاج مراجعة",
  "Overdue": "متأخرة",
  "Average Progress": "متوسط التقدم",
  "Create New Task": "إنشاء مهمة جديدة",
  "Task title": "عنوان المهمة",
  "Project": "المشروع",
  "No project": "بدون مشروع",
  "Assign people": "تعيين الموظفين",
  "Task type": "نوع المهمة",
  "Priority": "الأولوية",
  "Complexity": "التعقيد",
  "Planned due date": "تاريخ الاستحقاق المخطط",
  "Initial progress": "التقدم المبدئي",
  "Add task documents": "إضافة مستندات المهمة",
  "Create Task": "إنشاء المهمة",
  "Low priority": "أولوية منخفضة",
  "Medium priority": "أولوية متوسطة",
  "High priority": "أولوية عالية",
  "Urgent priority": "أولوية عاجلة",
  "Low": "منخفضة",
  "Medium": "متوسطة",
  "High": "عالية",
  "Urgent": "عاجلة",
  "New": "جديدة",
  "Assigned": "معيّنة",
  "In Progress": "قيد التنفيذ",
  "Blocked": "متوقفة",
  "Under Review": "قيد المراجعة",
  "Done": "مكتملة",
  "Take Task": "استلام المهمة",
  "Task created": "تم إنشاء المهمة",
  "Task updated": "تم تحديث المهمة",
  "Task requested": "تم طلب المهمة",
  "Claim approved · task started": "تمت الموافقة على الطلب · بدأت المهمة",
  "Claim rejected": "تم رفض الطلب",
  "Work submitted": "تم تسليم العمل",
  "Manager approved · task completed": "وافق المشرف · اكتملت المهمة",
  "Task reopened": "أُعيد فتح المهمة",
  "Task opened": "تم فتح المهمة",
  "Comment added": "تمت إضافة تعليق",
  "Comment edited": "تم تعديل التعليق",
  "Comment deleted": "تم حذف التعليق",
  "Files uploaded": "تم رفع الملفات",
  "Task reassigned": "تمت إعادة تعيين المهمة",
  "Work Intelligence": "ذكاء العمل",
  "Admin Audit": "سجل تدقيق الإدارة",
  "Mark all read": "تحديد الكل كمقروء",
  "Workflow & updates": "سير العمل والتحديثات",
  "Workflow history": "سجل سير العمل",
  "Reopen Completed Task": "إعادة فتح المهمة المكتملة",
  "Explain why this completed task must be reopened": "اشرح سبب ضرورة إعادة فتح المهمة المكتملة",
  "Finish Task": "إنهاء المهمة",
  "Approve": "اعتماد",
  "Reopen": "إعادة فتح",
  "Create Project": "إنشاء مشروع",
  "Project name": "اسم المشروع",
  "Description": "الوصف",
  "Project members": "أعضاء المشروع",
  "Save changes": "حفظ التغييرات",
  "Delete project": "حذف المشروع",
  "Completed work archive": "أرشيف الأعمال المكتملة",
  "Total completed": "إجمالي المكتمل",
  "This month": "هذا الشهر",
  "On time": "في الموعد",
  "More filters": "المزيد من عوامل التصفية",
  "All priorities": "كل الأولويات",
  "Assigned person": "الموظف المعيّن",
  "All people": "كل الموظفين",
  "Completed from": "مكتملة من",
  "Completed to": "مكتملة إلى",
  "Clear filters": "مسح عوامل التصفية",
  "No finished tasks found": "لا توجد مهام مكتملة",
  "Monthly Achievements": "الإنجازات الشهرية",
  "Department performance race": "سباق أداء القسم",
  "Month": "الشهر",
  "Rank": "الترتيب",
  "Team member": "عضو الفريق",
  "Achievement points": "نقاط الإنجاز",
  "Productivity index": "مؤشر الإنتاجية",
  "Complexity delivered": "التعقيد المنجز",
  "Speed vs peers": "السرعة مقارنةً بالفريق",
  "Team tasks": "المهام الجماعية",
  "Reopens": "مرات إعادة الفتح",
  "Evaluation": "التقييم",
  "Outstanding": "متميز",
  "Strong": "قوي",
  "Developing": "قيد التطور",
  "Needs support": "يحتاج دعماً",
  "Building history": "جارٍ بناء السجل",
  "How the fair score is calculated": "كيفية احتساب النتيجة العادلة",
  "Attendance month": "شهر الحضور",
  "Present today": "الحاضرون اليوم",
  "Tracked employees": "الموظفون المتابعون",
  "Average attendance": "متوسط الحضور",
  "KPI weighting": "وزن مؤشر الأداء",
  "Employee": "الموظف",
  "Present days": "أيام الحضور",
  "Expected workdays": "أيام العمل المتوقعة",
  "Attendance rate": "نسبة الحضور",
  "Login sessions": "مرات تسجيل الدخول",
  "Last login": "آخر تسجيل دخول",
  "No login recorded": "لا يوجد تسجيل دخول",
  "Analysis month": "شهر التحليل",
  "All time": "كل الفترات",
  "Completion rate": "نسبة الإنجاز",
  "On-time rate": "نسبة الالتزام بالموعد",
  "Active now": "نشطة الآن",
  "Active complexity": "تعقيد المهام النشطة",
  "Completed points": "النقاط المكتملة",
  "Achievement score": "نتيجة الإنجاز",
  "Admin reopens": "إعادات الفتح من المشرف",
  "Attendance KPI": "مؤشر الحضور",
  "Download": "تنزيل",
  "Username": "اسم المستخدم",
  "Password": "كلمة المرور",
  "Welcome back": "مرحباً بعودتك",
  "Secure access": "دخول آمن",
  "Login to Dashboard": "الدخول إلى لوحة التحكم",
  "Confirm deletion": "تأكيد الحذف",
  "Yes, delete": "نعم، احذف",
  "Search": "بحث",
  "All departments": "كل الأقسام",
  "Completion month": "شهر الإنجاز",
  "Total assigned": "إجمالي المهام المعيّنة",
  "Finished in month": "المكتمل خلال الشهر",
  "Average cycle time": "متوسط مدة الإنجاز",
  "Report": "التقرير",
  "Active load": "عبء العمل النشط",
  "No notifications yet.": "لا توجد إشعارات بعد.",
  "No normal users in this department.": "لا يوجد مستخدمون في هذا القسم.",
  "Private conversation · responses may need review": "محادثة خاصة · قد تحتاج الإجابات إلى مراجعة",
  "No messages yet. Say hello to your department.": "لا توجد رسائل بعد. ابدأ المحادثة مع قسمك.",
  "Mention someone": "الإشارة إلى شخص",
  "People in this conversation": "المشاركون في هذه المحادثة"
};

const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();

// Earlier translations were stored as UTF-8 bytes interpreted as Latin-1.
// Decode them on read so every existing Arabic label remains usable while the
// application is upgraded. New entries below use Unicode escapes deliberately
// so the source is safe in every editor and shell on Windows.
function decodeArabic(value: string) {
  if (!/[\u00c0-\u00ff]/.test(value)) return value;
  try {
    return new TextDecoder("utf-8").decode(Uint8Array.from(value, (character) => character.charCodeAt(0)));
  } catch {
    return value;
  }
}

const additionalArabic: Record<string, string> = {
  "Work Intelligence": "\u0630\u0643\u0627\u0621 \u0627\u0644\u0639\u0645\u0644",
  "Admin Audit": "\u0633\u062c\u0644 \u0627\u0644\u0625\u062f\u0627\u0631\u0629",
  "Settings": "\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a",
  "Overdue tasks": "\u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u0645\u062a\u0623\u062e\u0631\u0629",
  "Past their deadline": "\u062a\u062c\u0627\u0648\u0632\u062a \u0645\u0648\u0639\u062f\u0647\u0627 \u0627\u0644\u0646\u0647\u0627\u0626\u064a",
  "There are no overdue tasks.": "\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0647\u0627\u0645 \u0645\u062a\u0623\u062e\u0631\u0629.",
  "Available tasks": "\u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u0645\u062a\u0627\u062d\u0629",
  "Your workload": "\u0639\u0628\u0621 \u0639\u0645\u0644\u0643",
  "Review queue": "\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629",
  "Unassigned work": "\u0639\u0645\u0644 \u063a\u064a\u0631 \u0645\u0639\u064a\u0651\u0646",
  "Current work": "\u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u062d\u0627\u0644\u064a",
  "Create project": "\u0625\u0646\u0634\u0627\u0621 \u0645\u0634\u0631\u0648\u0639",
  "Name, department and team members": "\u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0644\u0642\u0633\u0645 \u0648\u0623\u0639\u0636\u0627\u0621 \u0627\u0644\u0641\u0631\u064a\u0642",
  "Project name": "\u0627\u0633\u0645 \u0627\u0644\u0645\u0634\u0631\u0648\u0639",
  "Short description": "\u0648\u0635\u0641 \u0645\u062e\u062a\u0635\u0631",
  "Project members": "\u0623\u0639\u0636\u0627\u0621 \u0627\u0644\u0645\u0634\u0631\u0648\u0639",
  "Manage team leaders": "\u0625\u062f\u0627\u0631\u0629 \u0642\u0627\u062f\u0629 \u0627\u0644\u0641\u0631\u0642",
  "Assign team leaders": "\u062a\u0639\u064a\u064a\u0646 \u0642\u0627\u062f\u0629 \u0627\u0644\u0641\u0631\u0642",
  "Save team leaders": "\u062d\u0641\u0638 \u0642\u0627\u062f\u0629 \u0627\u0644\u0641\u0631\u0642",
  "Edit project & members": "\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0645\u0634\u0631\u0648\u0639 \u0648\u0627\u0644\u0623\u0639\u0636\u0627\u0621",
  "Task documents": "\u0645\u0633\u062a\u0646\u062f\u0627\u062a \u0627\u0644\u0645\u0647\u0645\u0629",
  "Reference documents": "\u0627\u0644\u0645\u0633\u062a\u0646\u062f\u0627\u062a \u0627\u0644\u0645\u0631\u062c\u0639\u064a\u0629",
  "Completion documents": "\u0645\u0633\u062a\u0646\u062f\u0627\u062a \u0627\u0644\u0625\u0646\u062c\u0627\u0632",
  "Earlier attachments": "\u0627\u0644\u0645\u0631\u0641\u0642\u0627\u062a \u0627\u0644\u0633\u0627\u0628\u0642\u0629",
  "Upload": "\u0631\u0641\u0639",
  "Download": "\u062a\u0646\u0632\u064a\u0644",
  "Document name": "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u0646\u062f",
  "Section": "\u0627\u0644\u0642\u0633\u0645",
  "Replace file (optional)": "\u0627\u0633\u062a\u0628\u062f\u0627\u0644 \u0627\u0644\u0645\u0644\u0641 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)",
  "Save document": "\u062d\u0641\u0638 \u0627\u0644\u0645\u0633\u062a\u0646\u062f",
  "Work steps": "\u062e\u0637\u0648\u0627\u062a \u0627\u0644\u0639\u0645\u0644",
  "Add work step": "\u0625\u0636\u0627\u0641\u0629 \u062e\u0637\u0648\u0629 \u0639\u0645\u0644",
  "Work completion": "\u0625\u0646\u062c\u0627\u0632 \u0627\u0644\u0639\u0645\u0644",
  "Add step": "\u0625\u0636\u0627\u0641\u0629 \u062e\u0637\u0648\u0629",
  "Task completion checklist": "\u0642\u0627\u0626\u0645\u0629 \u0625\u0646\u062c\u0627\u0632 \u0627\u0644\u0645\u0647\u0645\u0629",
  "Assigned to": "\u0645\u0633\u0646\u062f\u0629 \u0625\u0644\u0649",
  "Deadline": "\u0627\u0644\u0645\u0648\u0639\u062f \u0627\u0644\u0646\u0647\u0627\u0626\u064a",
  "Pending with": "\u0628\u0627\u0646\u062a\u0638\u0627\u0631",
  "Next action": "\u0627\u0644\u0625\u062c\u0631\u0627\u0621 \u0627\u0644\u062a\u0627\u0644\u064a",
  "Department Chat": "\u0645\u062d\u0627\u062f\u062b\u0629 \u0627\u0644\u0642\u0633\u0645",
  "is in beta.": "\u0642\u064a\u062f \u0627\u0644\u062a\u062c\u0631\u0628\u0629.",
  "This feature is still being tested. You may encounter bugs or unexpected behavior.": "\u0647\u0630\u0647 \u0627\u0644\u0645\u064a\u0632\u0629 \u0642\u064a\u062f \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631. \u0642\u062f \u062a\u0648\u0627\u062c\u0647 \u0623\u062e\u0637\u0627\u0621 \u0623\u0648 \u0633\u0644\u0648\u0643\u064b\u0627 \u063a\u064a\u0631 \u0645\u062a\u0648\u0642\u0639.",
  "Delete all": "\u062d\u0630\u0641 \u0627\u0644\u0643\u0644",
  "Delete all TODOs?": "\u062d\u0630\u0641 \u0643\u0644 \u0627\u0644\u0645\u0647\u0627\u0645\u061f",
  "Dashboard": "\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645",
  "Active Tasks": "\u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u0646\u0634\u0637\u0629",
  "Finished Tasks": "\u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u0645\u0643\u062a\u0645\u0644\u0629",
  "People": "\u0627\u0644\u0623\u0634\u062e\u0627\u0635",
  "Projects": "\u0627\u0644\u0645\u0634\u0627\u0631\u064a\u0639",
  "Team": "\u0627\u0644\u0641\u0631\u064a\u0642",
  "My TODOs": "\u0645\u0647\u0627\u0645\u064a",
  "Achievements": "\u0627\u0644\u0625\u0646\u062c\u0627\u0632\u0627\u062a",
  "Attendance": "\u0627\u0644\u062d\u0636\u0648\u0631",
  "Productivity": "\u0627\u0644\u0625\u0646\u062a\u0627\u062c\u064a\u0629",
  "Messages": "\u0627\u0644\u0631\u0633\u0627\u0626\u0644",
  "Notifications": "\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a",
  "New Task": "\u0645\u0647\u0645\u0629 \u062c\u062f\u064a\u062f\u0629",
  "Create Task": "\u0625\u0646\u0634\u0627\u0621 \u0645\u0647\u0645\u0629",
  "Cancel": "\u0625\u0644\u063a\u0627\u0621",
  "Save": "\u062d\u0641\u0638",
  "Delete": "\u062d\u0630\u0641",
  "Edit": "\u062a\u0639\u062f\u064a\u0644",
  "Search": "\u0628\u062d\u062b",
  "Close": "\u0625\u063a\u0644\u0627\u0642",
  "Logout": "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c",
  "All departments": "\u062c\u0645\u064a\u0639 \u0627\u0644\u0623\u0642\u0633\u0627\u0645",
  "No project": "\u0628\u062f\u0648\u0646 \u0645\u0634\u0631\u0648\u0639",
  "No project assigned": "\u0644\u0645 \u064a\u062a\u0645 \u062a\u0639\u064a\u064a\u0646 \u0645\u0634\u0631\u0648\u0639",
  "Approved and completed": "\u062a\u0645 \u0627\u0644\u0627\u0639\u062a\u0645\u0627\u062f \u0648\u0627\u0644\u0625\u0646\u062c\u0627\u0632",
  "Submitted as complete, awaiting approval": "\u062a\u0645 \u062a\u0642\u062f\u064a\u0645\u0647\u0627 \u0643\u0645\u0643\u062a\u0645\u0644\u0629 \u0648\u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u0627\u0639\u062a\u0645\u0627\u062f",
  "Add work steps to measure completion": "\u0623\u0636\u0641 \u062e\u0637\u0648\u0627\u062a \u0639\u0645\u0644 \u0644\u0642\u064a\u0627\u0633 \u0627\u0644\u0625\u0646\u062c\u0627\u0632",
  "Edit work step": "\u062a\u0639\u062f\u064a\u0644 \u062e\u0637\u0648\u0629 \u0627\u0644\u0639\u0645\u0644",
  "Save step": "\u062d\u0641\u0638 \u0627\u0644\u062e\u0637\u0648\u0629",
  "Cancel editing": "\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u062a\u0639\u062f\u064a\u0644",
  "New work step": "\u062e\u0637\u0648\u0629 \u0639\u0645\u0644 \u062c\u062f\u064a\u062f\u0629",
  "Add a step, e.g. Prepare drawings": "\u0623\u0636\u0641 \u062e\u0637\u0648\u0629\u060c \u0645\u062b\u0644: \u0625\u0639\u062f\u0627\u062f \u0627\u0644\u0631\u0633\u0648\u0645\u0627\u062a",
  "Describe a measurable step": "\u0635\u0641 \u062e\u0637\u0648\u0629 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0642\u064a\u0627\u0633",
  "Download failed · click to retry": "\u0641\u0634\u0644 \u0627\u0644\u062a\u0646\u0632\u064a\u0644 \u00b7 \u0627\u0646\u0642\u0631 \u0644\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629",
  "This feature is in beta.": "\u0647\u0630\u0647 \u0627\u0644\u0645\u064a\u0632\u0629 \u0642\u064a\u062f \u0627\u0644\u062a\u062c\u0631\u0628\u0629.",
  "Could not connect to the server.": "\u062a\u0639\u0630\u0631 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0627\u0644\u062e\u0627\u062f\u0645.",
  "Worker": "\u0627\u0644\u0645\u0648\u0638\u0641",
  "All workers": "\u0643\u0644 \u0627\u0644\u0645\u0648\u0638\u0641\u064a\u0646",
  "Showing the tasks this worker is currently handling, including their latest updates.": "\u064a\u0639\u0631\u0636 \u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u062a\u064a \u064a\u0639\u0645\u0644 \u0639\u0644\u064a\u0647\u0627 \u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0638\u0641 \u062d\u0627\u0644\u064a\u064b\u0627 \u0648\u0622\u062e\u0631 \u062a\u062d\u062f\u064a\u062b\u0627\u062a\u0647\u0627.",
  "Choose a worker to see their current work and updates.": "\u0627\u062e\u062a\u0631 \u0645\u0648\u0638\u0641\u064b\u0627 \u0644\u0631\u0624\u064a\u0629 \u0639\u0645\u0644\u0647 \u0627\u0644\u062d\u0627\u0644\u064a \u0648\u062a\u062d\u062f\u064a\u062b\u0627\u062a\u0647.",
  "This worker has no tasks in the selected queue.": "\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0647\u0627\u0645 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0638\u0641 \u0641\u064a \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u062e\u062a\u0627\u0631\u0629.",
  "Worker workload": "\u0639\u0628\u0621 \u0639\u0645\u0644 \u0627\u0644\u0645\u0648\u0638\u0641",
  "See what each person is working on right now.": "\u0627\u0639\u0631\u0641 \u0645\u0627 \u064a\u0639\u0645\u0644 \u0639\u0644\u064a\u0647 \u0643\u0644 \u0634\u062e\u0635 \u0627\u0644\u0622\u0646.",
  "Show active work for": "\u0639\u0631\u0636 \u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u0646\u0634\u0637 \u0644\u0640",
  "Show all": "\u0639\u0631\u0636 \u0627\u0644\u0643\u0644",
  "Attach reference": "\u0625\u0631\u0641\u0627\u0642 \u0645\u0631\u062c\u0639",
  "Attach reference documents": "\u0625\u0631\u0641\u0627\u0642 \u0645\u0633\u062a\u0646\u062f\u0627\u062a \u0645\u0631\u062c\u0639\u064a\u0629",
  "Approve as department manager": "\u0627\u0639\u062a\u0645\u0627\u062f \u0643\u0645\u062f\u064a\u0631 \u0627\u0644\u0642\u0633\u0645",
  "Responsible": "\u0627\u0644\u0645\u0633\u0624\u0648\u0644",
  "Task owner · responsible for completion": "\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u0647\u0645\u0629 \u00b7 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0639\u0646 \u0625\u062a\u0645\u0627\u0645\u0647\u0627",
  "Shared responsibility": "\u0645\u0633\u0624\u0648\u0644\u064a\u0629 \u0645\u0634\u062a\u0631\u0643\u0629",
  "Primary responsibility": "\u0627\u0644\u0645\u0633\u0624\u0648\u0644\u064a\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629",
  "Needs assignment": "\u062a\u062d\u062a\u0627\u062c \u0625\u0644\u0649 \u062a\u0639\u064a\u064a\u0646",
};

export function translateText(value: string) {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const text = value.trim();
  let result = additionalArabic[text] ?? arabic[text];
  if (!result) {
    const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
      [/^(\d+) members?$/, (match) => `${match[1]} عضو`],
      [/^(\d+) unread$/, (match) => `${match[1]} غير مقروء`],
      [/^(\d+) recent$/, (match) => `${match[1]} حديث`],
      [/^(\d+) results?$/, (match) => `${match[1]} نتيجة`],
      [/^(\d+) points?$/, (match) => `${match[1]} نقطة`],
      [/^(\d+) days?$/, (match) => `${match[1]} يوم`]
    ];
    for (const [pattern, transform] of patterns) {
      const match = text.match(pattern);
      if (match) { result = transform(match); break; }
    }
  }
  if (!result) {
    const fragments: Array<[RegExp, string]> = [
      [/\bTask documents\b/g, "\u0645\u0633\u062a\u0646\u062f\u0627\u062a \u0627\u0644\u0645\u0647\u0645\u0629"],
      [/\bReference documents\b/g, "\u0627\u0644\u0645\u0633\u062a\u0646\u062f\u0627\u062a \u0627\u0644\u0645\u0631\u062c\u0639\u064a\u0629"],
      [/\bCompletion documents\b/g, "\u0645\u0633\u062a\u0646\u062f\u0627\u062a \u0627\u0644\u0625\u0646\u062c\u0627\u0632"],
      [/\bWork steps\b/g, "\u062e\u0637\u0648\u0627\u062a \u0627\u0644\u0639\u0645\u0644"],
      [/\bWork Intelligence\b/g, "\u0630\u0643\u0627\u0621 \u0627\u0644\u0639\u0645\u0644"],
      [/\bDepartment Chat\b/g, "\u0645\u062d\u0627\u062f\u062b\u0629 \u0627\u0644\u0642\u0633\u0645"],
      [/\bOverdue tasks\b/g, "\u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u0645\u062a\u0623\u062e\u0631\u0629"],
      [/\bCurrent department\b/g, "\u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u062d\u0627\u0644\u064a"],
      [/\bActive tasks\b/g, "\u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u0646\u0634\u0637\u0629"],
      [/\bcompleted\b/gi, "\u0645\u0643\u062a\u0645\u0644"],
      [/\bpending\b/gi, "\u0642\u064a\u062f \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631"],
      [/\bselected\b/gi, "\u0645\u062d\u062f\u062f"],
      [/\bopen\b/gi, "\u0645\u0641\u062a\u0648\u062d"],
      [/\bthis week\b/gi, "\u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0628\u0648\u0639"],
      [/\bin beta\b/gi, "\u0642\u064a\u062f \u0627\u0644\u062a\u062c\u0631\u0628\u0629"],
      [/\bUpload\b/g, "\u0631\u0641\u0639"],
      [/\bDownload\b/g, "\u062a\u0646\u0632\u064a\u0644"]
    ];
    const translatedFragments = fragments.reduce((next, [pattern, replacement]) => next.replace(pattern, replacement), text);
    if (translatedFragments !== text) result = translatedFragments;
  }
  return result ? `${leading}${decodeArabic(result)}${trailing}` : value;
}

const appliedText = new WeakMap<Text, string>();
const appliedAttributes = new WeakMap<Element, Map<string, string>>();

export function translateTree(language: SiteLanguage) {
  const root = document.body;
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const parent = node.parentElement;
    if (parent && !["SCRIPT", "STYLE"].includes(parent.tagName)) {
      if (!originalText.has(node) || node.nodeValue !== appliedText.get(node)) originalText.set(node, node.nodeValue ?? "");
      const source = originalText.get(node) ?? "";
      const next = language === "ar" ? translateText(source) : source;
      if (node.nodeValue !== next) node.nodeValue = next;
      appliedText.set(node, next);
    }
    node = walker.nextNode() as Text | null;
  }

  document.querySelectorAll("[placeholder], [title], [aria-label]").forEach((element) => {
    let saved = originalAttributes.get(element);
    if (!saved) { saved = new Map(); originalAttributes.set(element, saved); }
    let applied = appliedAttributes.get(element);
    if (!applied) { applied = new Map(); appliedAttributes.set(element, applied); }
    for (const attribute of ["placeholder", "title", "aria-label"]) {
      const current = element.getAttribute(attribute);
      if (current !== null && (!saved.has(attribute) || current !== applied.get(attribute))) saved.set(attribute, current);
      const source = saved.get(attribute);
      if (source !== undefined) {
        const next = language === "ar" ? translateText(source) : source;
        if (element.getAttribute(attribute) !== next) element.setAttribute(attribute, next);
        applied.set(attribute, next);
      }
    }
  });
}

export function useSiteTranslation(language: SiteLanguage) {
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    translateTree(language);
  });
}
