import { json } from "@/lib/server/auth";

export function GET() {
  return json({ ok: true });
}
