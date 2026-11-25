const test = require('node:test');
const assert = require('node:assert/strict');

const dbPath = require.resolve('../src/config/db');
const geminiPath = require.resolve('../src/services/geminiChatService');
let query;
let generate;
require.cache[dbPath] = { exports: { query: (...args) => query(...args) } };
require.cache[geminiPath] = { exports: { requestGeminiReply: options => generate(options) } };
const { suggestExpiringRecipe } = require('../src/services/expiringRecipeService');
process.env.GEMINI_API_KEY = 'test-key';

const target = { pantry_item_id: 10, ingredient_id: 40, quantity: '200', unit: 'g', storage_location: 'Ngăn mát', name: 'carrot', days_left: 1 };
const other = { pantry_item_id: 11, ingredient_id: 41, quantity: '2', unit: 'quả', storage_location: 'Ngăn mát', name: 'Trứng gà', days_left: 5 };
const answer = { possible: true, title: 'Trứng hấp cà rốt', ingredients: [{ id: '10', quantity: 150 }, { id: '11', quantity: 2 }], steps: ['Hấp chín cà rốt và trứng.'] };

function mockDatabase(rows, preferences = {}) {
  query = async (sql, args) => {
    assert.match(sql, /^SELECT/);
    if (sql.includes('FROM pantry_items')) {
      assert.match(sql, /p.user_id = \?.*p.quantity > 0.*p.expiry_date >= CURDATE\(\)/s);
      assert.deepEqual(args, [7, 10, 10, 10]);
      return [rows];
    }
    assert.match(sql, /FROM users/);
    assert.deepEqual(args, [7]);
    return [[preferences]];
  };
}

test('AI creates one dish from the selected item and available fridge stock without writing data', async () => {
  mockDatabase([target, other]);
  generate = async options => {
    assert.equal(options.generationConfig.responseMimeType, 'application/json');
    const input = JSON.parse(options.message);
    assert.equal(input.targetId, '10');
    assert.deepEqual(input.pantry.map(item => item.name), ['Cà rốt', 'Trứng gà']);
    return JSON.stringify(answer);
  };
  const recipe = await suggestExpiringRecipe(7, 10);
  assert.equal(recipe.title, answer.title);
  assert.deepEqual(recipe.ingredients.map(item => item.quantity), [150, 2]);
});

test('AI is skipped for unavailable, ineligible or incompatible pantry items', async () => {
  generate = async () => assert.fail('should not call Gemini');
  mockDatabase([other]);
  await assert.rejects(suggestExpiringRecipe(7, 10), { status: 404 });
  mockDatabase([{ ...target, days_left: 4 }, other]);
  await assert.rejects(suggestExpiringRecipe(7, 10), { status: 404 });
  mockDatabase([target, other], { allergies: ['Trứng'] });
  await assert.rejects(suggestExpiringRecipe(7, 10), { status: 422 });
});

test('invalid Gemini replies cannot introduce inventory items or exceed stock', async () => {
  mockDatabase([target, other]);
  for (const ingredients of [
    [{ id: '10', quantity: 250 }, { id: '11', quantity: 2 }],
    [{ id: '10', quantity: 150 }, { id: '99', quantity: 1 }],
    [{ id: '11', quantity: 1 }, { id: '11', quantity: 1 }],
  ]) {
    generate = async () => JSON.stringify({ ...answer, ingredients });
    await assert.rejects(suggestExpiringRecipe(7, 10), { status: 502 });
  }
});
