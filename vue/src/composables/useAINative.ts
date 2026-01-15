import { inject, type InjectionKey } from 'vue';
import type { AINativeConfig } from '../types';

export const AINativeConfigKey: InjectionKey<AINativeConfig> = Symbol('ainative-config');

export function useAINative(): AINativeConfig {
  const config = inject(AINativeConfigKey);

  if (!config) {
    throw new Error(
      'AINative config not found. Make sure to provide it using app.provide() with AINativeConfigKey.'
    );
  }

  return config;
}
