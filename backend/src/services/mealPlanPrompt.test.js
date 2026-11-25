const test = require("node:test");
const assert = require("node:assert/strict");
const buildMealPlanSystemInstruction = require("./mealPlanPrompt");

test("mealPlanPrompt generates valid system instruction with pantry context", () => {
  const prompt = buildMealPlanSystemInstruction(
    JSON.stringify({
      pantry: [{ name: "Trứng gà", quantity: 6, unit: "quả" }],
      preferences: { diet_type: "omnivore", allergies: "hải sản" },
    }),
    { daysCount: 2, mealsPerDay: 3, onlyPantry: true }
  );

  assert.ok(prompt.includes("Chef AI"), "Prompt includes role Chef AI");
  assert.ok(prompt.includes("Trứng gà"), "Prompt includes pantry context");
  assert.ok(prompt.includes("BẢNG THỰC ĐƠN"), "Prompt includes markdown table instruction");
  assert.ok(prompt.includes("json"), "Prompt includes json instruction");
});
