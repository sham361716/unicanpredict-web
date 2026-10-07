import { prisma } from "@/lib/server/db";
import { authenticate, forbidden, json, unauthorized } from "@/lib/server/auth";

export async function GET(req: Request) {
  const user = authenticate(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return forbidden();

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const userIds = [...new Set(entries.map((e) => e.userId).filter(Boolean))] as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, role: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return json(
    entries.map((e) => ({
      ...e,
      user: e.userId ? userMap.get(e.userId) ?? null : null,
    })),
  );
}
