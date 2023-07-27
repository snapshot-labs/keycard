describe('logKey', () => {
  describe('when the key does not exists', () => {
    it.todo('returns a 401 error');
  });

  describe('when the key is not active', () => {
    it.todo('returns a 401 error');
  });

  describe('when the key has exceeded the monthly quota', () => {
    it.todo('returns a 429 error');
  });

  describe('when the key is active', () => {
    it.todo('increment the key total usage');
  });
});
