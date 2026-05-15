const Session = require('../models/Session');
const Task = require('../models/Task');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// @desc  Log a completed focus session
// @route POST /api/sessions
const createSession = asyncHandler(async (req, res) => {
  const { taskId, durationMinutes, mode } = req.body;

  if (!durationMinutes || durationMinutes < 1) {
    return sendError(res, 'durationMinutes must be at least 1', 400);
  }

  const sessionData = {
    user: req.user._id,
    durationMinutes,
    mode: mode || 'focus',
  };

  // Optionally link to a task
  if (taskId) {
    const task = await Task.findOne({ _id: taskId, user: req.user._id });
    if (task) {
      sessionData.task = task._id;
      task.sessions = (task.sessions || 0) + 1;
      await task.save();
    }
  }

  const session = await Session.create(sessionData);
  sendSuccess(res, 'Session logged', { session }, 201);
});

// @desc  Get session stats for current user
// @route GET /api/sessions/stats
const getSessionStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [totalSessions, focusSessions, totalMinutesAgg] = await Promise.all([
    Session.countDocuments({ user: userId }),
    Session.countDocuments({ user: userId, mode: 'focus' }),
    Session.aggregate([
      { $match: { user: userId, mode: 'focus' } },
      { $group: { _id: null, total: { $sum: '$durationMinutes' } } },
    ]),
  ]);

  const totalMinutes = totalMinutesAgg[0]?.total || 0;
  const focusHours   = parseFloat((totalMinutes / 60).toFixed(1));

  sendSuccess(res, 'Session stats fetched', {
    totalSessions,
    focusSessions,
    focusHours,
  });
});

// @desc  Get recent sessions
// @route GET /api/sessions
const getSessions = asyncHandler(async (req, res) => {
  const sessions = await Session.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('task', 'title');
  sendSuccess(res, 'Sessions fetched', { sessions });
});

module.exports = { createSession, getSessionStats, getSessions };
