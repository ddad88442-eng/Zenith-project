const Note = require('../models/Note');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// @desc  Get all notes for current user
// @route GET /api/notes
const getNotes = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const query = { user: req.user._id };

  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    query.$or = [{ title: regex }, { content: regex }];
  }

  const notes = await Note.find(query).sort({ createdAt: -1 });
  sendSuccess(res, 'Notes fetched', { notes });
});

// @desc  Create a note
// @route POST /api/notes
const createNote = asyncHandler(async (req, res) => {
  const { title, content, bgColor, textColor } = req.body;
  const note = await Note.create({
    user: req.user._id,
    title: title || 'Untitled',
    content: content || '',
    bgColor: bgColor || '#1e2a3a',
    textColor: textColor || '#e2d9c9',
  });
  sendSuccess(res, 'Note created', { note }, 201);
});

// @desc  Update a note
// @route PUT /api/notes/:id
const updateNote = asyncHandler(async (req, res) => {
  const note = await Note.findOne({ _id: req.params.id, user: req.user._id });
  if (!note) return sendError(res, 'Note not found', 404);

  const { title, content, bgColor, textColor } = req.body;
  if (title     !== undefined) note.title     = title || 'Untitled';
  if (content   !== undefined) note.content   = content;
  if (bgColor   !== undefined) note.bgColor   = bgColor;
  if (textColor !== undefined) note.textColor = textColor;

  await note.save();
  sendSuccess(res, 'Note updated', { note });
});

// @desc  Delete a note
// @route DELETE /api/notes/:id
const deleteNote = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!note) return sendError(res, 'Note not found', 404);
  sendSuccess(res, 'Note deleted');
});

module.exports = { getNotes, createNote, updateNote, deleteNote };
