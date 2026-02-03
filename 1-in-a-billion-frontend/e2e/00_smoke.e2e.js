describe('Smoke', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('launches', async () => {
    // Minimal placeholder test. Once we add stable testIDs + mock mode,
    // we can navigate S12 -> S19 here deterministically.
    await expect(element(by.text('My Souls Library'))).toExist();
  });
});

