const express = require('express');
const router = express.Router();
const { createSession, getSessionStats, getSessions } = require('../controllers/sessionController');
const { protect } = require('../middleware/authMiddleware');

router.get('/',       protect, getSessions);
router.post('/',      protect, createSession);
router.get('/stats',  protect, getSessionStats);

module.exports = router;
