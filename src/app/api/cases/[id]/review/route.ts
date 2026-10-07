import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { authenticate, forbidden, json, unauthorized } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";

type Ctx = { params: Promise<{ id: string }> };

const reviewSchema = z.object({
  blindLabel: z.enum(["BENIGN", "MALIGNANT"]),
  finalLabel: z.enum(["BENIGN", "MALIGNANT"]),
  notes: z.string().optional(),
});

// Submit the pathologist's review. The blind read is locked client-side
// before the prediction is requested.
export async function POST(req: Request, ctx: Ctx) {
  const user = authenticate(req);
  if (!user) return unauthorized();
  if (user.role !== "PATHOLOGIST" && user.role !== "ADMIN") return forbidden();

  const { id } = await ctx.params;
  const existing = await prisma.case.findUnique({ where: { id } });
  if (!existing) return json({ error: "Case not found" }, 404);
  if (existing.status !== "UNDER_REVIEW") {
    return json({ error: "Case must be under review to submit a review" }, 409);
  }

  const parsed = reviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }
  const { blindLabel, finalLabel, notes } = parsed.data;

  const review = await prisma.review.create({
    data: { caseId: existing.id, reviewerId: user.sub, blindLabel, finalLabel, notes },
  });

  const updated = await prisma.case.update({
    where: { id: existing.id },
    data: { status: "VERIFIED" },
  });

  await logAudit({
    caseId: existing.id,
    userId: user.sub,
    action: "REVIEW_SUBMITTED",
    detail: `blind=${blindLabel} final=${finalLabel}`,
  });
  await logAudit({
    caseId: existing.id,
    userId: user.sub,
    action: "STATUS_TRANSITION",
    detail: "UNDER_REVIEW -> VERIFIED",
  });

  return json({ review, case: updated }, 201);
}
