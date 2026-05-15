const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// @desc  Register a new user
// @route POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) return sendError(res, 'Email already registered', 409);

  const user = await User.create({ username, email, password });
  const token = generateToken(user._id);

  sendSuccess(res, 'Registration successful', { token, user: user.toSafeObject() }, 201);
});

// @desc  Login
// @route POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return sendError(res, 'Invalid email or password', 401);
  }

  const token = generateToken(user._id);
  sendSuccess(res, 'Login successful', { token, user: user.toSafeObject() });
});

// @desc  Get current authenticated user
// @route GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  sendSuccess(res, 'User fetched', { user: req.user.toSafeObject() });
});

// @desc  Logout (client-side — just confirm)
// @route POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Logged out successfully');
});

module.exports = { register, login, getMe, logout };
