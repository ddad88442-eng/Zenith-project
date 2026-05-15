/**
 * Standard API response helpers.
 * All responses follow: { success, message, data }
 */

const sendSuccess = (res, message, data = {}, statusCode = 200) => {
  res.status(statusCode).json({ success: true, message, data });
};

const sendError = (res, message, statusCode = 400, errors = null) => {
  const payload = { success: false, message };
  if (errors) payload.errors = errors;
  res.status(statusCode).json(payload);
};

module.exports = { sendSuccess, sendError };
