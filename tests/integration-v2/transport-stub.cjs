'use strict';
// Explicitly injected test transport. Never contacts a backend or reads local tokens.
module.exports = { get: (...args) => global.__session3Transport.get(...args), put: (...args) => global.__session3Transport.put(...args),
  patch: (...args) => global.__session3Transport.patch(...args), post: (...args) => global.__session3Transport.post(...args) };
