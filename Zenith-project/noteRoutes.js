const express = require('express');
const router = express.Router();
const { getNotes, createNote, updateNote, deleteNote } = require('../controllers/noteController');
const { protect } = require('../middleware/authMiddleware');
const { noteValidation } = require('../validations/noteValidation');
const validate = require('../middleware/validationMiddleware');

router.get('/',      protect, getNotes);
router.post('/',     protect, noteValidation, validate, createNote);
router.put('/:id',   protect, noteValidation, validate, updateNote);
router.delete('/:id',protect, deleteNote);

module.exports = router;
