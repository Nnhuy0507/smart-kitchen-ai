const express = require('express');
const cors = require('cors');
const db = require('./src/config/db');
require('dotenv').config();

// --- 1. GỌI FILE ĐỊNH TUYẾN ĐĂNG KÝ ---
const authRoutes = require('./src/routes/authRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Backend is reachable' });
});

// API lấy món ăn cũ (Giữ nguyên)
app.get('/api/recipes', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT recipe_id, name, description, estimated_cost FROM recipes");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

// --- 2. CẤU HÌNH ĐƯỜNG DẪN API CHÍNH CHO ĐĂNG NHẬP/ĐĂNG KÝ ---
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server Backend AI Food đang chạy tại: http://localhost:${PORT}`);
});
