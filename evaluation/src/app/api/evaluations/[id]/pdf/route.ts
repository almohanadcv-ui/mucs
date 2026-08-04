import { withAuth } from "@/lib/api-handler";
import { Permission } from "@/core/domain/permissions";
import { getEvaluationPdf } from "@/core/application/evaluations/evaluation-service";

export const runtime = "nodejs";

type Params = { id: string };

/** Download one evaluation as the branded PDF. */
export const GET = withAuth<Params>(
  async ({ user, params }) => {
    const { buffer, filename } = await getEvaluationPdf(user, params.id);
    // RFC 5987 filename* carries the Arabic name safely across browsers.
    const encoded = encodeURIComponent(filename);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="evaluation.pdf"; filename*=UTF-8''${encoded}`,
      },
    });
  },
  {
    anyPermission: [
      Permission.EVALUATION_VIEW_OWN,
      Permission.EVALUATION_VIEW_TEAM,
      Permission.EVALUATION_VIEW_ALL,
    ],
  },
);
