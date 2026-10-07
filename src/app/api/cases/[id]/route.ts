import { prisma } from "@/lib/server/db";
import { authenticate, json, unauthorized } from "@/lib/server/auth";
import { imageMeta } from "@/lib/server/images";

type Ctx = { params: Promise<{ id: string }> };

// ── Get one case ─────────────────────────────────────────────────────
export async function GET(req: Request, ctx: Ctx) {
  const user = authenticate(req);
  if (!user) return unauthorized();

  const { id } = await ctx.params;
  const found = await prisma.case.findUnique({
    where: { id },
    include: {
      patient: true,
      images: { select: imageMeta },
      prediction: true,
      review: true,
      diagnosis: true,
    },
  });
  if (!found) return json({ error: "Case not found" }, 404);
  return json(found);
}
