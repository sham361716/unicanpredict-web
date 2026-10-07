import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { json, signToken } from "@/lib/server/auth";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: "Invalid email or password format" }, 400);
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return json({ error: "Invalid credentials" }, 401);

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return json({ error: "Invalid credentials" }, 401);

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });

  return json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}
