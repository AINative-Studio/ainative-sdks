import { writable } from 'svelte/store';
import type { AINativeConfig } from '../types';

export const ainativeConfig = writable<AINativeConfig>({
  apiKey: '',
  baseUrl: 'https://api.ainative.studio',
});

export function setAINativeConfig(config: AINativeConfig): void {
  ainativeConfig.set(config);
}
