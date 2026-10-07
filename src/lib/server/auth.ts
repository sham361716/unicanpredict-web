import jwt from "jsonwebtoken";

export interface AuthPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
}

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not set");
  return value;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: "8h" });
}

// Returns the verified payload, or null when the header is missing or invalid.
export function authenticate(req: Request): AuthPayload | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(header.slice("Bearer ".length), secret()) as AuthPayload;
  } catch {
    return null;
  }
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function unauthorized(): Response {
  return json({ error: "Missing or invalid token" }, 401);
}

export function forbidden(message = "Insufficient role"): Response {
  return json({ error: message }, 403);
}
