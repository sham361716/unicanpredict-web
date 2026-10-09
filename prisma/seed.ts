import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Demo accounts. The password comes from the environment so it is never
// stored in the repository.
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;

const USERS = [
  { email: "technician@unicanpredict.local", name: "Tina Technician", role: "TECHNICIAN" as const },
  { email: "pathologist@unicanpredict.local", name: "Pat Pathologist", role: "PATHOLOGIST" as const },
  { email: "clinician@unicanpredict.local", name: "Chris Clinician", role: "CLINICIAN" as const },
  { email: "admin@unicanpredict.local", name: "Alex Admin", role: "ADMIN" as const },
];

const prisma = new PrismaClient();

async function main() {
  if (!DEMO_PASSWORD) throw new Error("Set DEMO_PASSWORD before seeding");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash },
    });
  }
  console.log(`Seeded ${USERS.length} demo users.`);
}

main().finally(() => prisma.$disconnect());
