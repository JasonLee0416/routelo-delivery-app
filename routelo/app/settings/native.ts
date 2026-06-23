import AsyncStorage from '@react-native-async-storage/async-storage';

import { FeeSettings } from '../models';
import { DEFAULT_FEE_SETTINGS } from './districts';

const SETTINGS_KEY = '@routelo/settings/v1';

const mergeSettings = (stored?: Partial<FeeSettings> | null): FeeSettings => ({
  ...DEFAULT_FEE_SETTINGS,
  ...stored,
  districtFees: {
    ...DEFAULT_FEE_SETTINGS.districtFees,
    ...(stored?.districtFees || {}),
  },
});

export const settingsRepository = {
  async get(): Promise<FeeSettings> {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return mergeSettings();
    return mergeSettings(JSON.parse(raw) as Partial<FeeSettings>);
  },

  async save(settings: FeeSettings): Promise<void> {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(mergeSettings(settings)));
  },
};
