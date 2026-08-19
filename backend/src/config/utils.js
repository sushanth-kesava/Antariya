/**
 * Escape special regex characters in a string so it can be safely used
 * inside a MongoDB $regex query without risk of ReDoS or injection.
 *
 * @param {string} str - User-supplied string to escape
 * @returns {string} Escaped string safe for $regex
 */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { escapeRegex };
