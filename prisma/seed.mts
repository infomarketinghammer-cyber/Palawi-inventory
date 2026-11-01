// Seeds the first client (Palawi), its institution, two users and the default item master.
// Safe to run repeatedly: existing records are left alone.
// Run: npm run db:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { defaultItems } from "../src/lib/default-items.ts";

try {
  process.loadEnvFile();
} catch {
  // .env is optional when variables come from the environment.
}

const prisma = new PrismaClient();

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} (see .env.example)`);
  return v;
}

async function main() {
  const client =
    (await prisma.client.findUnique({ where: { code: "PALAWI" } })) ??
    (await prisma.client.create({
      data: {
        code: "PALAWI",
        nameMr: "पलावी", // [CONFIRM] Marathi spelling with the client
        nameEn: "Palawi",
        taglineMr: "जीवनाचा स्पर्श", // [CONFIRM]
        taglineEn: "a touch of life",
      },
    }));

  const institution =
    (await prisma.institution.findFirst({ where: { clientId: client.id, code: "PHP-PANDHARPUR" } })) ??
    (await prisma.institution.create({
      data: {
        clientId: client.id,
        code: "PHP-PANDHARPUR",
        nameMr: "प्रभा-हिरा प्रतिष्ठान, पंढरपूर",
        nameEn: "Prabha-Hira Pratishthan, Pandharpur",
        cityMr: "पंढरपूर",
        cityEn: "Pandharpur",
      },
    }));

  const users = [
    {
      name: "Palawi Admin",
      email: env("SEED_ADMIN_EMAIL").toLowerCase(),
      phone: process.env.SEED_ADMIN_PHONE || null,
      password: env("SEED_ADMIN_PASSWORD"),
      role: "ADMIN" as const,
      canManageClients: true,
      institutionId: null,
    },
    {
      name: "Store User",
      email: env("SEED_STORE_EMAIL").toLowerCase(),
      phone: process.env.SEED_STORE_PHONE || null,
      password: env("SEED_STORE_PASSWORD"),
      role: "STORE_USER" as const,
      canManageClients: false,
      institutionId: institution.id,
    },
  ];

  for (const { password, ...u } of users) {
    if (await prisma.user.findFirst({ where: { email: u.email } })) continue;
    const created = await prisma.user.create({
      data: { ...u, clientId: client.id, passwordHash: await bcrypt.hash(password, 11) },
    });
    await prisma.auditLog.create({
      data: { clientId: client.id, action: "create", entity: "User", entityId: created.id, newValue: { name: u.name, email: u.email, role: u.role }, reason: "seed" },
    });
    console.log(`Created ${u.role} ${u.email}`);
  }

  const existing = new Set((await prisma.item.findMany({ where: { clientId: client.id }, select: { code: true } })).map((i) => i.code));
  const missing = defaultItems(client.id).filter((i) => !existing.has(i.code));
  if (missing.length) await prisma.item.createMany({ data: missing });
  console.log(`Seeded client ${client.code}, institution ${institution.code}, ${missing.length} new items`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
