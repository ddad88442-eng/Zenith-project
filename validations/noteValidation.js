const { body } = require('express-validator');

const noteValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('content')
    .optional()
    .trim()
    .isLength({ max: 10000 }).withMessage('Content cannot exceed 10000 characters'),
  body('bgColor')
    .optional()
    .matches(/^#[0-9A-Fa-f]{3,8}$/).withMessage('Invalid background color format'),
  body('textColor')
    .optional()
    .matches(/^#[0-9A-Fa-f]{3,8}$/).withMessage('Invalid text color format'),
];

module.exports = { noteValidation };
