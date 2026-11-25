// Backend: Các đường dẫn API đăng nhập và đăng ký.
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Khai báo đường dẫn API xử lý đăng ký tài khoản
router.post('/register', authController.register);
router.post('/login', authController.login);
const passwordReset = require('../controllers/passwordResetController');
router.post('/password-reset/request', passwordReset.requestCode);
router.post('/password-reset/verify', passwordReset.verifyCode);
router.post('/password-reset/complete', passwordReset.resetPassword);
router.post('/google', require('../controllers/googleAuthController'));
router.use('/google/expo', require('./googleExpoRoutes'));

module.exports = router;
