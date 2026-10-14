// Reject MongoDB selector objects at the HTTP boundary. Internal server queries
// can then use operators such as $in without global sanitizeFilter rewriting them.
function assertSafeRequestObject(value) {
  const pending = [{ value, depth: 0 }];
  let visited = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current.value || typeof current.value !== 'object') continue;
    visited += 1;
    if (visited > 10000 || current.depth > 32) {
      const error = new Error('Request structure exceeds allowed limits.');
      error.statusCode = 400;
      throw error;
    }

    for (const [key, nested] of Object.entries(current.value)) {
      if (key.startsWith('$') || key.includes('.') || ['__proto__', 'constructor', 'prototype'].includes(key)) {
        const error = new Error('Request contains a prohibited object key.');
        error.statusCode = 400;
        throw error;
      }
      if (nested && typeof nested === 'object') {
        pending.push({ value: nested, depth: current.depth + 1 });
      }
    }
  }
}

function rejectQuerySelectors(req, res, next) {
  try {
    assertSafeRequestObject(req.body);
    assertSafeRequestObject(req.query);
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { assertSafeRequestObject, rejectQuerySelectors };
