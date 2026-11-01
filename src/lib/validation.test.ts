import { test } from "node:test";
import assert from "node:assert/strict";
import { clientCreateSchema, echo, fieldErrors, formToObject, userCreateSchema } from "./validation.ts";

test("missing fields are reported as required (translation keys, not library English)", () => {
  const r = clientCreateSchema.safeParse(formToObject(fd({ "client.code": "x" })));
  assert.equal(r.success, false);
  const errors = fieldErrors(r.error!);
  assert.equal(errors["client.code"], "tooShort:2");
  assert.equal(errors["client.nameMr"], "required");
  assert.equal(errors["admin.password"], "required");
  for (const msg of Object.values(errors)) assert.match(msg, /^[a-zA-Z.]+(:\d+)?$/);
});

test("users need a phone or an email; phone is normalised", () => {
  const base = { name: "Asha", password: "secret123", role: "STORE_USER" };
  const none = userCreateSchema.safeParse({ ...base, phone: "", email: "" });
  assert.equal(none.success, false);
  assert.equal(fieldErrors(none.error!).phone, "identifierRequired");

  const ok = userCreateSchema.safeParse({ ...base, phone: "+91 98765-43210", email: "" });
  assert.equal(ok.success, true);
  assert.equal(ok.data!.phone, "9876543210");
  assert.equal(ok.data!.email, undefined);
});

test("codes are upper-cased and restricted", () => {
  const client = clientCreateSchema.shape.client;
  assert.equal(client.safeParse({ code: "palawi-2", nameMr: "अ", nameEn: "A" }).data?.code, "PALAWI-2");
  assert.equal(client.safeParse({ code: "पालवी", nameMr: "अ", nameEn: "A" }).success, false);
});

test("echo never sends passwords back", () => {
  assert.deepEqual(echo(fd({ name: "A", password: "p", "admin.password": "q", $ACTION_ID: "x" })), { name: "A" });
});

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.append(k, v);
  return f;
}
