import { create } from 'zustand';

import { persistSetting, type AppSettings, type ScanLookbackMonths } from '@/services/settings-persist';
import { DEFAULT_MODEL_ID, type ModelId } from '@/services/model-catalog';
import { DEFAULT_WINDOWS, type ScheduleWindow } from '@/services/llm-schedule';
import { markLookbackExpanded } from '@/services/scan-window';

type SettingsState = AppSettings & {
  replaceAll: (settings: AppSettings) => void;
  setOfflineMode: (offlineMode: boolean) => void;
  setPrivacyOn: (privacyOn: boolean) => void;
  setModelId: (modelId: ModelId) => void;
  setCustomUrls: (urls: {
    customModelUrl: string;
    customTokenizerUrl: string;
    customTokenizerConfigUrl: string;
  }) => void;
  setWindows: (windows: ScheduleWindow[]) => void;
  setScanLookbackMonths: (months: ScanLookbackMonths) => void;
  setGoogleAccount: (googleAccount: string) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  offlineMode: true,
  privacyOn: true,
  modelId: DEFAULT_MODEL_ID,
  customModelUrl: '',
  customTokenizerUrl: '',
  customTokenizerConfigUrl: '',
  windows: DEFAULT_WINDOWS,
  scanLookbackMonths: 1,
  googleAccount: '',
  replaceAll: (settings) => set(settings),
  setOfflineMode: (offlineMode) => {
    set({ offlineMode });
    void persistSetting('offlineMode', offlineMode);
  },
  setPrivacyOn: (privacyOn) => {
    set({ privacyOn });
    void persistSetting('privacyOn', privacyOn);
  },
  setModelId: (modelId) => {
    set({ modelId });
    void persistSetting('modelId', modelId);
  },
  setCustomUrls: (urls) => {
    set(urls);
    void persistSetting('customModelUrl', urls.customModelUrl);
    void persistSetting('customTokenizerUrl', urls.customTokenizerUrl);
    void persistSetting('customTokenizerConfigUrl', urls.customTokenizerConfigUrl);
  },
  setWindows: (windows) => {
    set({ windows });
    void persistSetting('windows', windows);
  },
  setScanLookbackMonths: (scanLookbackMonths) => {
    const previous = useSettingsStore.getState().scanLookbackMonths;
    set({ scanLookbackMonths });
    void persistSetting('scanLookbackMonths', scanLookbackMonths);
    if (scanLookbackMonths > previous) {
      void markLookbackExpanded(scanLookbackMonths);
    }
  },
  setGoogleAccount: (googleAccount) => {
    set({ googleAccount });
    void persistSetting('googleAccount', googleAccount);
  },
}));
