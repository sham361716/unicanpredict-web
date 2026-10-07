import { prisma } from "@/lib/server/db";
import { authenticate, forbidden, json, unauthorized } from "@/lib/server/auth";
import { imageMeta } from "@/lib/server/images";

// Cases where the pathologist's final verdict disagreed with the AI
// prediction — candidates for future retraining review, for curation by
// an admin, not auto-trusted labels.
export async function GET(req: Request) {
  const user = authenticate(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return forbidden();

  const cases = await prisma.case.findMany({
    where: { review: { disagreesWithAi: true } },
    include: {
      patient: true,
      images: { select: imageMeta },
      prediction: true,
      review: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return json(cases);
}
