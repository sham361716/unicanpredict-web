// Image rows are returned to clients without their bytes. Bytes are served
// only from /api/uploads/:name, so case lists stay small.
export const imageMeta = {
  id: true,
  caseId: true,
  storedName: true,
  originalMime: true,
  createdAt: true,
} as const;

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg"] as const;
// Vercel functions accept request bodies up to 4.5 MB, so keep uploads under that.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
