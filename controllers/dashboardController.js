const Task = require('../models/Task');
const Note = require('../models/Note');
const Session = require('../models/Session');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');

// @desc  Get full dashboard stats
// @route GET /api/dashboard
const getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [tasks, notesCount, sessionStats] = await Promise.all([
    Task.find({ user: userId }),
    Note.countDocuments({ user: userId }),
    Session.aggregate([
      { $match: { user: userId, mode: 'focus' } },
      { $group: { _id: null, count: { $sum: 1 }, totalMinutes: { $sum: '$durationMinutes' } } },
    ]),
  ]);

  const total     = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const remaining = total - completed;
  const productivity = total > 0 ? Math.round((completed / total) * 100) : 0;

  const highCount   = tasks.filter((t) => t.priority === 'high').length;
  const mediumCount = tasks.filter((t) => t.priority === 'medium').length;
  const lowCount    = tasks.filter((t) => t.priority === 'low').length;

  const focusSessions = sessionStats[0]?.count || 0;
  const focusHours    = parseFloat(((sessionStats[0]?.totalMinutes || 0) / 60).toFixed(1));

  const recentTasks = tasks
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map((t) => ({
      _id:      t._id,
      title:    t.title,
      status:   t.status,
      priority: t.priority,
      due:      t.due,
      completed: t.completed,
    }));

  sendSuccess(res, 'Dashboard stats fetched', {
    stats: {
      total,
      completed,
      remaining,
      productivity,
      notesCount,
      focusSessions,
      focusHours,
    },
    priority: { high: highCount, medium: mediumCount, low: lowCount },
    recentTasks,
  });
});

module.exports = { getDashboardStats };
