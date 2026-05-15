const { validationResult } = require('express-validator');
const { sendError } = require('../utils/apiResponse');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    return sendError(res, messages[0], 400, errors.array());
  }
  next();
};

module.exports = validate;
