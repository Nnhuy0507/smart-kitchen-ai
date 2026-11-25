const test = require('node:test');
const assert = require('node:assert/strict');
const handoff = require('./chatRouting');

test('planning requests open the planner', () => {
  for (const question of ['Lập thực đơn 7 ngày cho 2 người', 'Tuần này ăn gì?', 'Tạo danh sách đi chợ', 'len thuc don cho gia dinh']) {
    assert.equal(handoff(question)?.action, 'meal-plan', question);
  }
});

test('cooking questions stay in chat, including dishes from a plan', () => {
  for (const question of ['Canh bị mặn thì làm sao?', 'Thay sữa tươi bằng gì?', 'Có trứng, nấu gì trong 15 phút?', 'Cách nấu món cá trong thực đơn?', 'Bảo quản thức ăn được 3 ngày không?']) {
    assert.equal(handoff(question), null, question);
  }
});
