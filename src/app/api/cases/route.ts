import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { authenticate, forbidden, json, unauthorized } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";
import { ORGANS } from "@/lib/server/cases";
import { imageMeta } from "@/lib/server/images";

const createCaseSchema = z.object({
  patientPseudonym: z.string().min(1),
  organ: z.enum(ORGANS),
});

// ── Create a case (technician) ─────────────────────────────────────
export async function POST(req: Request) {
  const user = authenticate(req);
  if (!user) return unauthorized();
  if (user.role !== "TECHNICIAN") return forbidden();

  const parsed = createCaseSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }
  const { patientPseudonym, organ } = parsed.data;

  const patient = await prisma.patient.upsert({
    where: { pseudonymRef: patientPseudonym },
    update: {},
    create: { pseudonymRef: patientPseudonym },
  });

  const created = await prisma.case.create({
    data: { organ, status: "DRAFT", patientId: patient.id, uploadedById: user.sub },
  });

  await logAudit({
    caseId: created.id,
    userId: user.sub,
    action: "CASE_CREATED",
    detail: `organ=${organ}`,
  });

  return json(created, 201);
}

// ── List cases (scoped by role) ─────────────────────────────────────
export async function GET(req: Request) {
  const user = authenticate(req);
  if (!user) return unauthorized();

  const role = user.role;
  const where =
    role === "TECHNICIAN"
      ? { uploadedById: user.sub }
      : role === "PATHOLOGIST"
        ? { status: { in: ["AWAITING_REVIEW", "UNDER_REVIEW"] } }
        : role === "CLINICIAN"
          ? { status: { in: ["VERIFIED", "DIAGNOSED"] } }
          : role === "ADMIN"
            ? {}
            : { status: "RELEASED" }; // PATIENT

  const cases = await prisma.case.findMany({
    where,
    include: { patient: true, images: { select: imageMeta } },
    orderBy: { createdAt: "desc" },
  });
  return json(cases);
}
