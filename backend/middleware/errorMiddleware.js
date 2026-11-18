// Fallback for missing routes
const notFound = (req, res, next) => {
  // Avoid reflecting resource paths or identifiers in an API response.
  const error = new Error('Resource not found.');
  res.status(404);
  next(error);
};

// General error handler
const errorHandler = (err, req, res, next) => {
  const requestedStatus = err.statusCode || err.status || (res.statusCode === 200 ? 500 : res.statusCode);
  let statusCode = Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus <= 599 ? requestedStatus : 500;
  let message = err.message;

  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    message = 'Resource not found. Invalid ID format.';
    statusCode = 404;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (err.type === 'entity.parse.failed') message = 'Invalid JSON request.';
  if (err.type === 'entity.too.large') message = 'Request payload exceeds the allowed size.';
  if (isProduction && statusCode >= 500) {
    message = 'An unexpected server error occurred.';
  }

  let stack = isProduction ? null : err.stack;
  if (stack && typeof stack === 'string') {
    // Academic honesty & security constraint: Never expose storage keys or internal paths in stacks
    stack = stack.replace(/cases\/[a-zA-Z0-9_-]+\/[^\s)]+/g, '[REDACTED_STORAGE_KEY]');
  }

  if (statusCode >= 500 && process.env.NODE_ENV !== 'test') {
    // Structured server-side record; the error message never includes request bodies.
    console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'unhandled_error', reqId: req.id || null, name: err.name, code: err.code || null, error: String(err.message || '').slice(0, 300) }));
  }

  res.status(statusCode).json({
    message,
    stack,
    // Lets support match a user's report to the server log line.
    ...(statusCode >= 500 && req.id ? { requestId: req.id } : {}),
  });
};

module.exports = { notFound, errorHandler };
