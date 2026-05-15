/**
 * Safely parse JSON without throwing.
 */
const safeParse = (str, fallback = null) => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

module.exports = safeParse;
