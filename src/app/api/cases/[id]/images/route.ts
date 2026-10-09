import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/server/db";
import { authenticate, forbidden, json, unauthorized } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";
import { imageMeta, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/server/images";

type Ctx = { params: Promise<{ id: string }> };

// ── Upload image to a DRAFT case (technician, owner only) ───────────
export async function POST(req: Request, ctx: Ctx) {
  const user = authenticate(req);
  if (!user) return unauthorized();
  if (user.role !== "TECHNICIAN") return forbidden();

  const { id } = await ctx.params;
  const existing = await prisma.case.findUnique({ where: { id } });
  if (!existing) return json({ error: "Case not found" }, 404);
  if (existing.uploadedById !== user.sub) return json({ error: "Not your case" }, 403);
  if (existing.status !== "DRAFT") {
    return json({ error: "Can only add images while case is in DRAFT" }, 409);
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File)) return json({ error: "No image uploaded" }, 400);
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return json({ error: "Only PNG/JPEG images are accepted" }, 400);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return json({ error: "Image is larger than 4 MB" }, 413);
  }

  // UUID name only, never the original filename, per the
  // "no original filenames/EXIF" compliance requirement.
  const ext = path.extname(file.name).toLowerCase();
  const storedName = `${uuidv4()}${ext}`;
  const data = Buffer.from(await file.arrayBuffer());

  const image = await prisma.caseImage.create({
    data: {
      caseId: existing.id,
      storedName,
      originalMime: file.type,
      data,
    },
    select: imageMeta,
  });

  await logAudit({
    caseId: existing.id,
    userId: user.sub,
    action: "IMAGE_UPLOADED",
    detail: image.storedName,
  });

  return json(image, 201);
}
