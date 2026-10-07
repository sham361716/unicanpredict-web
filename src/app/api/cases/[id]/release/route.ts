import { prisma } from "@/lib/server/db";
import { authenticate, forbidden, json, unauthorized } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";

type Ctx = { params: Promise<{ id: string }> };

// Clinician releases the case to the patient (DIAGNOSED -> RELEASED, immutable).
export async function POST(req: Request, ctx: Ctx) {
  const user = authenticate(req);
  if (!user) return unauthorized();
  if (user.role !== "CLINICIAN" && user.role !== "ADMIN") return forbidden();

  const { id } = await ctx.params;
  const existing = await prisma.case.findUnique({ where: { id } });
  if (!existing) return json({ error: "Case not found" }, 404);
  if (existing.status !== "DIAGNOSED") {
    return json({ error: "Case must be DIAGNOSED before release" }, 409);
  }

  await prisma.diagnosis.update({
    where: { caseId: existing.id },
    data: { releasedAt: new Date() },
  });

  const updated = await prisma.case.update({
    where: { id: existing.id },
    data: { status: "RELEASED" },
  });

  await logAudit({
    caseId: existing.id,
    userId: user.sub,
    action: "STATUS_TRANSITION",
    detail: "DIAGNOSED -> RELEASED",
  });

  return json(updated);
}
