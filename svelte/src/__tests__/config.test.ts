import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { ainativeConfig, setAINativeConfig } from '../stores/config';

describe('config store', () => {
  it('should have default config', () => {
    const config = get(ainativeConfig);
    expect(config.apiKey).toBe('');
    expect(config.baseUrl).toBe('https://api.ainative.studio');
  });

  it('should update config via setAINativeConfig', () => {
    setAINativeConfig({ apiKey: 'test-key', baseUrl: 'https://test.api' });
    const config = get(ainativeConfig);
    expect(config.apiKey).toBe('test-key');
    expect(config.baseUrl).toBe('https://test.api');
  });
});
