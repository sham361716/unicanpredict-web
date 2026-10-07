import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { authenticate, forbidden, json, unauthorized } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";

type Ctx = { params: Promise<{ id: string }> };

const diagnosisSchema = z.object({ summary: z.string().min(1) });

// Clinician saves a diagnosis (VERIFIED -> DIAGNOSED).
export async function POST(req: Request, ctx: Ctx) {
  const user = authenticate(req);
  if (!user) return unauthorized();
  if (user.role !== "CLINICIAN" && user.role !== "ADMIN") return forbidden();

  const { id } = await ctx.params;
  const existing = await prisma.case.findUnique({ where: { id } });
  if (!existing) return json({ error: "Case not found" }, 404);
  if (existing.status !== "VERIFIED") {
    return json({ error: "Case must be VERIFIED before diagnosis" }, 409);
  }

  const parsed = diagnosisSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  const diagnosis = await prisma.diagnosis.upsert({
    where: { caseId: existing.id },
    update: { summary: parsed.data.summary },
    create: { caseId: existing.id, clinicianId: user.sub, summary: parsed.data.summary },
  });

  const updated = await prisma.case.update({
    where: { id: existing.id },
    data: { status: "DIAGNOSED" },
  });

  await logAudit({ caseId: existing.id, userId: user.sub, action: "DIAGNOSIS_SAVED" });
  await logAudit({
    caseId: existing.id,
    userId: user.sub,
    action: "STATUS_TRANSITION",
    detail: "VERIFIED -> DIAGNOSED",
  });

  return json({ diagnosis, case: updated }, 201);
}
