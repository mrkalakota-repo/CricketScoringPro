let counter = 0;
module.exports = {
  randomUUID: () => `test-uuid-${++counter}`,
};
