const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    desc: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: ['todo', 'inprogress', 'done'],
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    due: {
      type: String, // store as YYYY-MM-DD string to match frontend
      default: '',
    },
    completed: {
      type: Boolean,
      default: false,
    },
    sessions: {
      type: Number,
      default: 0,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Sync completed with status
taskSchema.pre('save', function (next) {
  this.completed = this.status === 'done';
  next();
});

module.exports = mongoose.model('Task', taskSchema);
