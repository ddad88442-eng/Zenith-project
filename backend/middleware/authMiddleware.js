const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { sendError } = require('../utils/apiResponse');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return sendError(res, 'Not authorized — no token provided', 401);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return sendError(res, 'Not authorized — token invalid or expired', 401);
  }

  const user = await User.findById(decoded.id).select('-password');
  if (!user) {
    return sendError(res, 'Not authorized — user not found', 401);
  }

  req.user = user;
  next();
});

module.exports = { protect };
