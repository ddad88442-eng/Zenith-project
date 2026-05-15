const { body } = require('express-validator');

const taskValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Task title is required')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('status')
    .optional()
    .isIn(['todo', 'inprogress', 'done']).withMessage('Status must be todo, inprogress, or done'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
];

module.exports = { taskValidation };
