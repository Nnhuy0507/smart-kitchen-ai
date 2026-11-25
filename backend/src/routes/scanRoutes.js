const express = require('express');
const multer = require('multer');
const getScanModelUrl = require('../services/scanModel');
const ingredientNameVi = require('../services/ingredientNameVi');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });

router.post('/', (req, res) => {
  upload.single('file')(req, res, async error => {
    if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      success: false, detail: error.code === 'LIMIT_FILE_SIZE' ? 'Ảnh không được vượt quá 15 MB' : 'Dữ liệu tải ảnh không hợp lệ',
    });
    if (!req.file) return res.status(400).json({ success: false, detail: 'Chưa có ảnh để nhận diện' });
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(req.file.mimetype)) {
      return res.status(400).json({ success: false, detail: 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP' });
    }
    try {
      const body = new FormData();
      body.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);
      const base = await getScanModelUrl();
      const response = await fetch(`${base}/predict`, { method: 'POST', body, signal: AbortSignal.timeout(45000) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success || !Array.isArray(result.detections)) {
        return res.status(response.ok ? 502 : response.status).json({
          success: false,
          detail: typeof result?.detail === 'string' ? result.detail : `Dịch vụ model trả lỗi HTTP ${response.status}.`,
        });
      }
      const detections = result.detections.map(detection => {
        if (typeof detection?.name !== 'string') return detection;
        return { ...detection, name: ingredientNameVi(detection.name) };
      });
      return res.json({ ...result, detections });
    } catch (error) {
      console.error('Scan model request failed:', error.cause?.code || error.message);
      return res.status(503).json({ success: false, detail: 'Backend chưa tải được model nhận diện. Kiểm tra cấu hình Python và log backend.' });
    }
  });
});

module.exports = router;
