import { test } from "node:test";
import assert from "node:assert/strict";
import { scopeArgs, TenantViolation } from "./tenant-scope.ts";

const A = "client-a";
const B = "client-b";

test("reads are pinned to the session client and hide soft-deleted rows", () => {
  assert.deepEqual(scopeArgs("User", "findMany", { where: { role: "ADMIN" } }, A), {
    where: { role: "ADMIN", clientId: A, deletedAt: { isSet: false } },
  });
  assert.deepEqual(scopeArgs("Institution", "count", undefined, A), { where: { clientId: A, deletedAt: { isSet: false } } });
  // Audit log has no soft delete.
  assert.deepEqual(scopeArgs("AuditLog", "findMany", {}, A), { where: { clientId: A } });
});

test("findUnique by id still cannot reach another client's row", () => {
  assert.deepEqual(scopeArgs("User", "findUnique", { where: { id: "u1" } }, A), {
    where: { id: "u1", clientId: A, deletedAt: { isSet: false } },
  });
});

test("an explicit deletedAt filter is respected", () => {
  const out = scopeArgs("User", "findMany", { where: { deletedAt: { not: null } } }, A);
  assert.deepEqual(out.where, { deletedAt: { not: null }, clientId: A });
});

test("asking for another client's rows throws", () => {
  assert.throws(() => scopeArgs("User", "findMany", { where: { clientId: B } }, A), TenantViolation);
});

test("creates are stamped with the session client", () => {
  assert.deepEqual(scopeArgs("Institution", "create", { data: { code: "X" } }, A), { data: { code: "X", clientId: A } });
  assert.deepEqual(scopeArgs("User", "createMany", { data: [{ name: "a" }, { name: "b" }] }, A), {
    data: [
      { name: "a", clientId: A },
      { name: "b", clientId: A },
    ],
  });
});

test("writing a row for another client throws", () => {
  assert.throws(() => scopeArgs("Institution", "create", { data: { code: "X", clientId: B } }, A), TenantViolation);
  assert.throws(() => scopeArgs("User", "update", { where: { id: "u" }, data: { clientId: B } }, A), TenantViolation);
  assert.throws(() => scopeArgs("User", "create", { data: { client: { connect: { id: B } } } }, A), TenantViolation);
});

test("updates and deletes are scoped (no soft-delete filter on writes)", () => {
  assert.deepEqual(scopeArgs("User", "update", { where: { id: "u" }, data: { active: false } }, A), {
    where: { id: "u", clientId: A },
    data: { active: false },
  });
  assert.deepEqual(scopeArgs("User", "deleteMany", {}, A), { where: { clientId: A } });
});

test("upsert scopes the lookup and stamps the create", () => {
  const out = scopeArgs("Institution", "upsert", { where: { id: "i" }, create: { code: "X" }, update: {} }, A);
  assert.deepEqual(out, { where: { id: "i", clientId: A }, create: { code: "X", clientId: A }, update: {} });
});

test("non-tenant models pass through; missing client throws", () => {
  assert.deepEqual(scopeArgs("Client", "findMany", { where: {} }, A), { where: {} });
  assert.throws(() => scopeArgs("User", "findMany", {}, ""), TenantViolation);
});
