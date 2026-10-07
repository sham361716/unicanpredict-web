import { prisma } from "./db";

export async function logAudit(params: {
  caseId?: string;
  userId?: string;
  action: string;
  detail?: string;
}) {
  await prisma.auditLog.create({ data: params });
}
