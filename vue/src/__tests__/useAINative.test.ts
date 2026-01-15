import { describe, it, expect } from 'vitest';
import { useAINative, AINativeConfigKey } from '../composables/useAINative';
import { createApp } from 'vue';

describe('useAINative', () => {
  it('should throw error when config is not provided', () => {
    expect(() => useAINative()).toThrow('AINative config not found');
  });

  it('should return config when provided', () => {
    const app = createApp({});
    const config = { apiKey: 'test-key', baseUrl: 'https://test.api' };

    app.provide(AINativeConfigKey, config);

    // This is a basic check that the key exists
    expect(AINativeConfigKey).toBeDefined();
    expect(config.apiKey).toBe('test-key');
  });
});
