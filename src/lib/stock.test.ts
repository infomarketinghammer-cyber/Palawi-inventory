import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBalances, daysOfStock, findShortages, linesToMovements, stockStatus } from "./stock.ts";

test("grain register only consumes: OUT consumption, never IN", () => {
  assert.deepEqual(linesToMovements("grain", [{ itemId: "rice", inQty: 25, outQty: 4.5 }]), [
    { itemId: "rice", qty: 4.5, direction: "OUT", type: "consumption" },
  ]);
  assert.deepEqual(linesToMovements("grain", [{ itemId: "rice", inQty: 0, outQty: 0 }]), []);
});

test("vegetables/fruit: bought and used the same day nets to zero; donated fruit is a donation", () => {
  const m = linesToMovements("fruit", [{ itemId: "banana", outQty: 3, source: "donated" }]);
  assert.deepEqual(m, [
    { itemId: "banana", qty: 3, direction: "IN", type: "donation" },
    { itemId: "banana", qty: 3, direction: "OUT", type: "consumption" },
  ]);
  assert.equal(linesToMovements("vegetables", [{ itemId: "onion", outQty: 2 }])[0].type, "purchase");
});

test("personal items and cleaning issue from stock", () => {
  assert.deepEqual(linesToMovements("cleaning", [{ itemId: "phenyl", outQty: 2 }]), [
    { itemId: "phenyl", qty: 2, direction: "OUT", type: "distribution" },
  ]);
});

test("kind registers map each kind to a direction and ledger type", () => {
  const m = linesToMovements("utensils", [
    { itemId: "plate", kind: "issue", outQty: 30 },
    { itemId: "plate", kind: "return", inQty: 2 },
    { itemId: "glass", kind: "damage", outQty: 1 },
    { itemId: "glass", kind: "loss", outQty: 1 },
  ]);
  assert.deepEqual(
    m.map((x) => `${x.itemId}:${x.direction}:${x.type}:${x.qty}`),
    ["plate:OUT:distribution:30", "plate:IN:return:2", "glass:OUT:damage:1", "glass:OUT:loss:1"],
  );
  assert.equal(linesToMovements("adjustment", [{ itemId: "x", kind: "adjust_out", outQty: 1 }])[0].type, "adjustment");
  assert.equal(linesToMovements("purchase", [{ itemId: "x", kind: "opening", inQty: 10 }])[0].type, "opening");
});

test("meals and expenses never move stock; lines without an item are ignored", () => {
  assert.deepEqual(linesToMovements("meals", [{ itemId: "x", inQty: 1 }]), []);
  assert.deepEqual(linesToMovements("grain", [{ itemId: "", inQty: 1 }]), []);
});

test("balance counts approved rows only; pending shown separately; rejected ignored", () => {
  const b = computeBalances([
    { itemId: "rice", qty: 50, direction: "IN", status: "APPROVED" },
    { itemId: "rice", qty: 4.2, direction: "OUT", status: "APPROVED" },
    { itemId: "rice", qty: 0.1, direction: "OUT", status: "APPROVED" },
    { itemId: "rice", qty: 10, direction: "IN", status: "PENDING" },
    { itemId: "rice", qty: 3, direction: "OUT", status: "PENDING" },
    { itemId: "rice", qty: 99, direction: "IN", status: "REJECTED" },
  ]);
  assert.deepEqual(b.get("rice"), { approved: 45.7, pendingIn: 10, pendingOut: 3 });
});

test("shortages: cannot consume more than available, same-entry IN counts", () => {
  const avail = (id: string) => ({ rice: 5, dal: 0 })[id] ?? 0;
  assert.deepEqual(
    findShortages(
      [
        { itemId: "rice", qty: 6, direction: "OUT", type: "consumption" },
        { itemId: "dal", qty: 2, direction: "IN", type: "purchase" },
        { itemId: "dal", qty: 2, direction: "OUT", type: "consumption" },
      ],
      avail,
    ),
    [{ itemId: "rice", need: 6, available: 5 }],
  );
});

test("status and days of stock", () => {
  assert.equal(stockStatus(0, 5), "out");
  assert.equal(stockStatus(5, 5), "low");
  assert.equal(stockStatus(6, 5), "ok");
  assert.equal(stockStatus(6, null), "ok");
  assert.equal(daysOfStock(30, 60, 30), 15);
  assert.equal(daysOfStock(30, 0, 30), null);
});
