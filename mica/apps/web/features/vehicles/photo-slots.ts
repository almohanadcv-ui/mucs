/** Photo gallery slots for a vehicle, grouped by area. The slot key is stored
 *  in each Attachment's `documentType`, so the gallery is organized per-box. */
export const PHOTO_SLOT_GROUPS: { title: string; slots: { key: string; label: string }[] }[] = [
  {
    title: "الصور الخارجية",
    slots: [
      { key: "EXT_FRONT", label: "الأمام" },
      { key: "EXT_BACK", label: "الخلف" },
      { key: "EXT_RIGHT", label: "الجانب الأيمن" },
      { key: "EXT_LEFT", label: "الجانب الأيسر" },
      { key: "EXT_FRONT_ANGLE", label: "زاوية أمامية" },
      { key: "EXT_BACK_ANGLE", label: "زاوية خلفية" },
    ],
  },
  {
    title: "الصور الداخلية",
    slots: [
      { key: "INT_DASHBOARD", label: "لوحة القيادة" },
      { key: "INT_FRONT_SEATS", label: "المقاعد الأمامية" },
      { key: "INT_BACK_SEATS", label: "المقاعد الخلفية" },
    ],
  },
  {
    title: "التوثيق",
    slots: [
      { key: "DOC_ODOMETER", label: "العداد" },
      { key: "DOC_FUEL", label: "مستوى الوقود" },
      { key: "DOC_PLATE", label: "لوحة المركبة" },
      { key: "DOC_VIN", label: "رقم الهيكل (VIN)" },
    ],
  },
  {
    title: "أسفل المركبة",
    slots: [
      { key: "UND_FRONT", label: "أسفل المقدمة" },
      { key: "UND_MID", label: "أسفل المنتصف" },
      { key: "UND_REAR", label: "أسفل الخلفية" },
    ],
  },
];
