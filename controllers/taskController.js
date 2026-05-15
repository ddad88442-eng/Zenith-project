const Task = require('../models/Task');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// @desc  Get all tasks for the current user
// @route GET /api/tasks
const getTasks = asyncHandler(async (req, res) => {
  const { filter, search, page = 1, limit = 100 } = req.query;

  const query = { user: req.user._id };
  if (filter && filter !== 'all') query.status = filter;
  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    query.$or = [{ title: regex }, { desc: regex }];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [tasks, total] = await Promise.all([
    Task.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    Task.countDocuments(query),
  ]);

  sendSuccess(res, 'Tasks fetched', { tasks, total, page: parseInt(page) });
});

// @desc  Create a task
// @route POST /api/tasks
const createTask = asyncHandler(async (req, res) => {
  const { title, desc, status, priority, due } = req.body;
  const task = await Task.create({
    user: req.user._id,
    title: title.trim(),
    desc: (desc || '').trim(),
    status: status || 'todo',
    priority: priority || 'medium',
    due: due || '',
  });
  sendSuccess(res, 'Task created', { task }, 201);
});

// @desc  Update a task
// @route PUT /api/tasks/:id
const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, user: req.user._id });
  if (!task) return sendError(res, 'Task not found', 404);

  const { title, desc, status, priority, due, sessions } = req.body;
  if (title    !== undefined) task.title    = title.trim();
  if (desc     !== undefined) task.desc     = desc.trim();
  if (status   !== undefined) task.status   = status;
  if (priority !== undefined) task.priority = priority;
  if (due      !== undefined) task.due      = due;
  if (sessions !== undefined) task.sessions = sessions;

  await task.save();
  sendSuccess(res, 'Task updated', { task });
});

// @desc  Delete a task
// @route DELETE /api/tasks/:id
const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!task) return sendError(res, 'Task not found', 404);
  sendSuccess(res, 'Task deleted');
});

// @desc  Toggle task completion
// @route PATCH /api/tasks/:id/toggle
const toggleTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, user: req.user._id });
  if (!task) return sendError(res, 'Task not found', 404);
  task.completed = !task.completed;
  task.status    = task.completed ? 'done' : 'todo';
  await task.save();
  sendSuccess(res, 'Task toggled', { task });
});

// @desc  Reorder tasks (drag & drop)
// @route PATCH /api/tasks/reorder
const reorderTasks = asyncHandler(async (req, res) => {
  const { orderedIds } = req.body; // array of task IDs in new order
  if (!Array.isArray(orderedIds)) return sendError(res, 'orderedIds must be an array', 400);

  const bulkOps = orderedIds.map((id, index) => ({
    updateOne: { filter: { _id: id, user: req.user._id }, update: { $set: { order: index } } },
  }));
  await Task.bulkWrite(bulkOps);
  sendSuccess(res, 'Tasks reordered');
});

module.exports = { getTasks, createTask, updateTask, deleteTask, toggleTask, reorderTasks };
