import JSZip from "jszip";
import { prisma } from "@/lib/server/db";
import { authenticate, forbidden, json, unauthorized } from "@/lib/server/auth";

// Builds a ZIP of disagreement-case images plus a labels.csv, on demand.
// There is no server disk to keep a "folder" on, so this is built fresh
// each time it is requested rather than stored anywhere.
export async function GET(req: Request) {
  const user = authenticate(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return forbidden();

  const cases = await prisma.case.findMany({
    where: { review: { disagreesWithAi: true } },
    include: { patient: true, images: true, prediction: true, review: true },
    orderBy: { updatedAt: "desc" },
  });

  if (cases.length === 0) {
    return json({ error: "No disagreement cases to export" }, 404);
  }

  const zip = new JSZip();
  const rows = [
    "case_id,patient_ref,organ,ai_label,ai_probability,model_version,blind_label,final_label,reviewed_at,image_file",
  ];

  for (const c of cases) {
    const image = c.images[0];
    const imageFile = image ? `images/${c.id}${extFromMime(image.originalMime)}` : "";
    if (image) zip.file(imageFile, image.data);

    rows.push(
      [
        c.id,
        c.patient?.pseudonymRef ?? "",
        c.organ,
        c.prediction?.label ?? "",
        c.prediction?.probability?.toFixed(4) ?? "",
        c.prediction?.modelVersion ?? "",
        c.review?.blindLabel ?? "",
        c.review?.finalLabel ?? "",
        c.review?.createdAt.toISOString() ?? "",
        imageFile,
      ]
        .map(csvField)
        .join(","),
    );
  }

  zip.file("labels.csv", rows.join("\n"));

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="disagreement-cases-${new Date().toISOString().slice(0, 10)}.zip"`,
    },
  });
}

function extFromMime(mime: string): string {
  return mime === "image/png" ? ".png" : ".jpg";
}

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
