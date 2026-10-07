import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { authenticate, forbidden, json, unauthorized } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";

type Ctx = { params: Promise<{ id: string }> };

const predictionSchema = z.object({
  modelVersion: z.string().min(1),
  label: z.enum(["BENIGN", "MALIGNANT"]),
  probability: z.number().min(0).max(1),
  logits: z.record(z.string(), z.array(z.number())),
});

// Save the AI prediction. Inference runs in the browser; the server only stores it.
export async function POST(req: Request, ctx: Ctx) {
  const user = authenticate(req);
  if (!user) return unauthorized();
  if (user.role !== "PATHOLOGIST" && user.role !== "ADMIN") return forbidden();

  const { id } = await ctx.params;
  const existing = await prisma.case.findUnique({ where: { id } });
  if (!existing) return json({ error: "Case not found" }, 404);
  if (existing.status !== "UNDER_REVIEW") {
    return json({ error: "Case must be under review to record a prediction" }, 409);
  }

  const parsed = predictionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }
  const { modelVersion, label, probability, logits } = parsed.data;

  const prediction = await prisma.aiPrediction.upsert({
    where: { caseId: existing.id },
    update: { modelVersion, organ: existing.organ, label, probability, logitsJson: JSON.stringify(logits) },
    create: {
      caseId: existing.id,
      modelVersion,
      organ: existing.organ,
      label,
      probability,
      logitsJson: JSON.stringify(logits),
    },
  });

  await logAudit({
    caseId: existing.id,
    userId: user.sub,
    action: "AI_PREDICTION_RECORDED",
    detail: `${label} (${(probability * 100).toFixed(1)}%) model=${modelVersion}`,
  });

  return json(prediction, 201);
}
