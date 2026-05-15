const express = require('express');
const router = express.Router();
const {
  getTasks, createTask, updateTask,
  deleteTask, toggleTask, reorderTasks,
} = require('../controllers/taskController');
const { protect } = require('../middleware/authMiddleware');
const { taskValidation } = require('../validations/taskValidation');
const validate = require('../middleware/validationMiddleware');

router.get('/',              protect, getTasks);
router.post('/',             protect, taskValidation, validate, createTask);
router.patch('/reorder',     protect, reorderTasks);
router.put('/:id',           protect, taskValidation, validate, updateTask);
router.delete('/:id',        protect, deleteTask);
router.patch('/:id/toggle',  protect, toggleTask);

module.exports = router;
