import { authenticate, json, unauthorized } from "@/lib/server/auth";

export async function GET(req: Request) {
  const user = authenticate(req);
  if (!user) return unauthorized();
  return json({ user });
}
