const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const path = require('path');
const fs = require('fs');

// @desc  Get user profile
// @route GET /api/users/profile
const getProfile = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Profile fetched', { user: req.user.toSafeObject() });
});

// @desc  Update user profile
// @route PUT /api/users/profile
const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!user) return sendError(res, 'User not found', 404);

  const { username, email, newPassword } = req.body;

  if (username) user.username = username.trim();
  if (email) {
    // Check unique email
    const emailTaken = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
    if (emailTaken) return sendError(res, 'Email already in use by another account', 409);
    user.email = email.toLowerCase().trim();
  }

  if (newPassword) {
    if (newPassword.length < 6) return sendError(res, 'New password must be at least 6 characters', 400);
    user.password = newPassword;
  }

  // Avatar upload (multer file)
  if (req.file) {
    // Remove old avatar file if it's a local upload
    if (user.avatar && user.avatar.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '../uploads', path.basename(user.avatar));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    user.avatar = `/uploads/${req.file.filename}`;
  }

  await user.save();
  sendSuccess(res, 'Profile updated successfully', { user: user.toSafeObject() });
});

module.exports = { getProfile, updateProfile };
