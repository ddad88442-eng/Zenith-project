const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
      default: 'Untitled',
    },
    content: {
      type: String,
      trim: true,
      maxlength: [10000, 'Content cannot exceed 10000 characters'],
      default: '',
    },
    bgColor: {
      type: String,
      default: '#1e2a3a',
      match: [/^#[0-9A-Fa-f]{3,8}$/, 'Invalid color format'],
    },
    textColor: {
      type: String,
      default: '#e2d9c9',
      match: [/^#[0-9A-Fa-f]{3,8}$/, 'Invalid color format'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Note', noteSchema);
