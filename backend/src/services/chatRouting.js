function getChatHandoff(message) {
  const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
  const planning = /\b(lap|len|tao|xep|sap xep|thiet ke|goi y)\b/.test(text)
    && /\b(thuc don|ke hoach an|lich an|lich bua an)\b/.test(text);
  const multipleDays = /\b(an gi|nau gi|mon an|bua an|thuc don)\b/.test(text)
    && /\b(ca tuan|tuan nay|tuan sau|moi ngay|[2-9]\d* ngay|mot tuan)\b/.test(text);
  const shopping = /\b(lap|tao|len|tong hop)\b/.test(text)
    && /\b(danh sach mua sam|danh sach di cho|danh sach can mua)\b/.test(text);
  if (!planning && !multipleDays && !shopping) return null;
  return {
    reply: 'Mình giúp bạn chế biến, thay nguyên liệu và xử lý món ăn trong lúc nấu. Để sắp xếp các bữa theo ngày, cân đối ngân sách và chuẩn bị nguyên liệu cần mua, bạn hãy mở Thực đơn. Bạn vẫn có thể quay lại hỏi mình cách nấu từng món.',
    action: 'meal-plan',
    actionLabel: 'Mở Thực đơn',
  };
}

module.exports = getChatHandoff;
