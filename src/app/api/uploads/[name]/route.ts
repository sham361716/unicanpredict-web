import { prisma } from "@/lib/server/db";
import { json } from "@/lib/server/auth";

type Ctx = { params: Promise<{ name: string }> };

// Serves a stored image. Looked up by the UUID name only.
export async function GET(_req: Request, ctx: Ctx) {
  const { name } = await ctx.params;
  const image = await prisma.caseImage.findUnique({
    where: { storedName: name },
    select: { data: true, originalMime: true },
  });
  if (!image) return json({ error: "Image not found" }, 404);

  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.originalMime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
