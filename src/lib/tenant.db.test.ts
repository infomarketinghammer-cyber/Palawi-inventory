// Integration test: tenant isolation against a real MongoDB. Uses a throwaway database
// (<MONGODB_DB>-test, dropped afterwards); skipped when MONGODB_URI is not configured.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { MongoClient } from "mongodb";
import type { PrismaClient } from "@prisma/client";
import { TenantViolation } from "./tenant-scope.ts";

try {
  process.loadEnvFile();
} catch {
  // CI may provide variables directly.
}
const uri = process.env.MONGODB_URI;
const dbName = `${process.env.MONGODB_DB ?? "palawi-inventory"}-test`;
const skip = !uri && "MONGODB_URI not set";

let prisma: PrismaClient;
let tenantDb: typeof import("./tenant.ts").tenantDb;
const ids = { a: "", b: "", userA: "", userB: "", deletedA: "" };

before(async () => {
  if (skip) return;
  const url = `${uri!.replace(/\/?$/, "/")}${dbName}?retryWrites=true&w=majority`;
  await promisify(exec)("npx prisma db push --skip-generate", { env: { ...process.env, DATABASE_URL: url } });
  process.env.DATABASE_URL = url;
  ({ prisma } = await import("./db.ts"));
  ({ tenantDb } = await import("./tenant.ts"));

  const a = await prisma.client.create({ data: { code: `A${Date.now()}`, nameMr: "अ", nameEn: "A" } });
  const b = await prisma.client.create({ data: { code: `B${Date.now()}`, nameMr: "ब", nameEn: "B" } });
  const mk = (clientId: string, name: string, extra = {}) =>
    prisma.user.create({ data: { clientId, name, passwordHash: "x", role: "STORE_USER", email: `${name}@t.test`, ...extra } });
  ids.a = a.id;
  ids.b = b.id;
  ids.userA = (await mk(a.id, "ua")).id;
  ids.userB = (await mk(b.id, "ub")).id;
  ids.deletedA = (await mk(a.id, "gone", { deletedAt: new Date() })).id;
});

after(async () => {
  if (skip) return;
  await prisma?.$disconnect();
  const m = new MongoClient(uri!);
  await m.connect();
  await m.db(dbName).dropDatabase();
  await m.close();
});

test("lists only the session client's live users", { skip }, async () => {
  const users = await tenantDb(ids.a).user.findMany();
  assert.deepEqual(users.map((u) => u.id), [ids.userA]);
});

test("cannot read another client's row by id", { skip }, async () => {
  assert.equal(await tenantDb(ids.a).user.findUnique({ where: { id: ids.userB } }), null);
  assert.equal(await tenantDb(ids.a).user.findFirst({ where: { id: ids.userB } }), null);
});

test("cannot update or delete another client's row", { skip }, async () => {
  await assert.rejects(tenantDb(ids.a).user.update({ where: { id: ids.userB }, data: { name: "hacked" } }));
  const res = await tenantDb(ids.a).user.updateMany({ data: { name: "renamed" } });
  assert.equal(res.count, 2); // userA and the soft-deleted user, both client A
  const b = await prisma.user.findUniqueOrThrow({ where: { id: ids.userB } });
  assert.equal(b.name, "ub");
});

test("cannot create rows for another client", { skip }, async () => {
  await assert.rejects(
    tenantDb(ids.a).institution.create({ data: { clientId: ids.b, code: "X", nameMr: "x", nameEn: "x" } }),
    TenantViolation,
  );
  const inst = await tenantDb(ids.a).institution.create({ data: { clientId: ids.a, code: "OK", nameMr: "x", nameEn: "x" } });
  assert.equal(inst.clientId, ids.a);
});

test("isolation also holds inside transactions", { skip }, async () => {
  const seen = await tenantDb(ids.a).$transaction(async (tx) => tx.user.findMany({ where: { id: { in: [ids.userA, ids.userB] } } }));
  assert.deepEqual(seen.map((u) => u.id), [ids.userA]);
});
