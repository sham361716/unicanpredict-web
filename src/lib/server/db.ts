import { PrismaClient } from "@prisma/client";

// One client per runtime. Serverless functions reuse warm instances, so a
// module-level singleton avoids opening a new connection pool per request.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
