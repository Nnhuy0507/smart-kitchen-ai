/* global __dirname */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(name, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, "../lib", name + ".ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  new Function("exports", "require", outputText)(exports, key => dependencies[key]);
  return exports;
}

const { foodCategory, suggestedLocation, suggestedExpiry } = load("foodStorage", {
  "./calendar": load("calendar"),
});

test("different raw proteins use different refrigerated and frozen estimates", () => {
  const base = "2026-11-25";
  for (const [name, chilled, frozen] of [
    ["Thịt bò", "2026-11-28", "2027-03-25"],
    ["Thịt heo xay", "2026-11-27", "2027-02-23"],
    ["Ức gà", "2026-11-27", "2027-08-22"],
    ["Cá cơm", "2026-11-27", "2027-01-24"],
    ["Tôm", "2026-11-27", "2027-02-23"],
  ]) {
    assert.equal(foodCategory(name), "Thịt cá");
    assert.equal(suggestedExpiry(name, "Thịt cá", "Ngăn mát", base), chilled);
    assert.equal(suggestedExpiry(name, "Thịt cá", "Ngăn đông", base), frozen);
    assert.equal(suggestedExpiry(name, "Thịt cá", "Bên ngoài", base), "");
  }
});

test("food names resolve without substring or accent collisions", () => {
  assert.equal(foodCategory("Cà rốt"), "Rau củ");
  assert.equal(foodCategory("Bơ"), "Rau củ");
  assert.equal(foodCategory("Bơ sữa"), "Sữa & trứng");
  assert.equal(suggestedLocation("Gạo", "Ngũ cốc"), "Bên ngoài");
  assert.equal(suggestedLocation("Cơm nguội", "Ngũ cốc"), "Ngăn mát");
});

test("estimates start from the selected purchase date and skip unsupported combinations", () => {
  assert.equal(suggestedExpiry("Cá", "Thịt cá", "Ngăn mát", "28/02/2024"), "2024-03-01");
  assert.equal(suggestedExpiry("Cá", "Thịt cá", "Ngăn mát", "31/02/2026"), "");
  assert.equal(suggestedExpiry("Trứng gà", "Sữa & trứng", "Ngăn đông", "2026-11-25"), "");
  assert.equal(suggestedExpiry("Thực phẩm chưa rõ", "Khác", "Ngăn mát", "2026-11-25"), "");
});

test("every Vietnamese scanner label has a storage suggestion", () => {
  const labels = require("../../backend/src/ai_service/ingredient_labels_vi.json");
  for (const name of new Set(Object.values(labels))) {
    const category = foodCategory(name);
    const location = suggestedLocation(name, category);
    assert.ok(suggestedExpiry(name, category, location, "2026-11-25"), name);
  }
  assert.equal(foodCategory("Đậu gà"), "Rau củ");
  assert.equal(suggestedLocation("Tỏi tây", "Rau củ"), "Ngăn mát");
});
