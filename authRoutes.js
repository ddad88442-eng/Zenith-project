const express = require('express');
const router = express.Router();
const { register, login, getMe, logout } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { registerValidation, loginValidation } = require('../validations/authValidation');
const validate = require('../middleware/validationMiddleware');
const { authLimiter } = require('../middleware/rateLimitMiddleware');

router.post('/register', authLimiter, registerValidation, validate, register);
router.post('/login',    authLimiter, loginValidation,    validate, login);
router.post('/logout',   protect, logout);
router.get('/me',        protect, getMe);

module.exports = router;
