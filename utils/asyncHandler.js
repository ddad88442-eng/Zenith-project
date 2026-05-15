/**
 * Wraps async route handlers to automatically catch errors
 * and pass them to Express's next() error handler.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
