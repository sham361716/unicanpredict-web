import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { authenticate, forbidden, json, unauthorized } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";
import { canTransition, type CaseStatus } from "@/lib/server/cases";

type Ctx = { params: Promise<{ id: string }> };

const transitionSchema = z.object({ to: z.string() });

// Technician-owned transitions only from DRAFT/REJECTED_QC; everything past
// AWAITING_REVIEW belongs to pathologist/clinician roles.
const ROLE_FOR_TRANSITION: Record<string, string> = {
  AWAITING_REVIEW: "TECHNICIAN",
  UNDER_REVIEW: "PATHOLOGIST",
  REJECTED_QC: "PATHOLOGIST",
  VERIFIED: "PATHOLOGIST",
  DIAGNOSED: "CLINICIAN",
  RELEASED: "CLINICIAN",
};

// ── Transition a case's status ───────────────────────────────────────
export async function POST(req: Request, ctx: Ctx) {
  const user = authenticate(req);
  if (!user) return unauthorized();

  const parsed = transitionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Missing target status" }, 400);

  const { id } = await ctx.params;
  const existing = await prisma.case.findUnique({ where: { id } });
  if (!existing) return json({ error: "Case not found" }, 404);

  const from = existing.status as CaseStatus;
  const to = parsed.data.to as CaseStatus;

  if (!canTransition(from, to)) {
    return json({ error: `Cannot transition ${from} -> ${to}` }, 409);
  }

  const requiredRole = ROLE_FOR_TRANSITION[to];
  if (requiredRole && user.role !== requiredRole && user.role !== "ADMIN") {
    return forbidden(`Only ${requiredRole} can perform this transition`);
  }

  if (to === "AWAITING_REVIEW") {
    const imageCount = await prisma.caseImage.count({ where: { caseId: existing.id } });
    if (imageCount === 0) {
      return json({ error: "Case needs at least one image before submission" }, 409);
    }
  }

  const updated = await prisma.case.update({
    where: { id: existing.id },
    data: { status: to },
  });

  await logAudit({
    caseId: existing.id,
    userId: user.sub,
    action: "STATUS_TRANSITION",
    detail: `${from} -> ${to}`,
  });

  return json(updated);
}
