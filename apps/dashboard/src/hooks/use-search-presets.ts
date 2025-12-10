import { useState, useCallback, useEffect } from 'react';
import type { SearchPreset } from '@/types/api';

const PRESETS_STORAGE_KEY = 'gemindex-search-presets';
const LAST_SETTINGS_STORAGE_KEY = 'gemindex-last-search-settings';

export interface SearchSettings {
  systemPrompt: string;
  model: string;
  temperature: number | undefined;
  topP: number | undefined;
  topK: number | undefined;
  maxOutputTokens: number | undefined;
}

const DEFAULT_SETTINGS: SearchSettings = {
  systemPrompt: '',
  model: 'gemini-2.5-flash',
  temperature: undefined,
  topP: undefined,
  topK: undefined,
  maxOutputTokens: undefined,
};

export const AVAILABLE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

function loadPresets(): SearchPreset[] {
  try {
    const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function savePresets(presets: SearchPreset[]): void {
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

function loadLastSettings(): SearchSettings {
  try {
    const stored = localStorage.getItem(LAST_SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

function saveLastSettings(settings: SearchSettings): void {
  localStorage.setItem(LAST_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function useSearchPresets() {
  const [presets, setPresets] = useState<SearchPreset[]>([]);
  const [settings, setSettingsState] = useState<SearchSettings>(DEFAULT_SETTINGS);
  const [initialized, setInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setPresets(loadPresets());
    setSettingsState(loadLastSettings());
    setInitialized(true);
  }, []);

  // Save settings to localStorage whenever they change (after initialization)
  useEffect(() => {
    if (initialized) {
      saveLastSettings(settings);
    }
  }, [settings, initialized]);

  const setSettings = useCallback(
    (newSettings: SearchSettings | ((prev: SearchSettings) => SearchSettings)) => {
      setSettingsState(newSettings);
    },
    []
  );

  const resetSettings = useCallback(() => {
    setSettingsState(DEFAULT_SETTINGS);
  }, []);

  const savePreset = useCallback(
    (name: string) => {
      const newPreset: SearchPreset = {
        id: crypto.randomUUID(),
        name,
        systemPrompt: settings.systemPrompt,
        model: settings.model,
        temperature: settings.temperature ?? 1.0,
        topP: settings.topP ?? 0.95,
        topK: settings.topK ?? 40,
        maxOutputTokens: settings.maxOutputTokens ?? 8192,
      };
      const updatedPresets = [...presets, newPreset];
      setPresets(updatedPresets);
      savePresets(updatedPresets);
      return newPreset;
    },
    [presets, settings]
  );

  const loadPreset = useCallback(
    (presetId: string) => {
      const preset = presets.find((p) => p.id === presetId);
      if (preset) {
        setSettingsState({
          systemPrompt: preset.systemPrompt,
          model: preset.model,
          temperature: preset.temperature,
          topP: preset.topP,
          topK: preset.topK,
          maxOutputTokens: preset.maxOutputTokens,
        });
      }
    },
    [presets]
  );

  const deletePreset = useCallback(
    (presetId: string) => {
      const updatedPresets = presets.filter((p) => p.id !== presetId);
      setPresets(updatedPresets);
      savePresets(updatedPresets);
    },
    [presets]
  );

  const updatePreset = useCallback(
    (presetId: string, name: string) => {
      const updatedPresets = presets.map((p) =>
        p.id === presetId
          ? {
              ...p,
              name,
              systemPrompt: settings.systemPrompt,
              model: settings.model,
              temperature: settings.temperature ?? 1.0,
              topP: settings.topP ?? 0.95,
              topK: settings.topK ?? 40,
              maxOutputTokens: settings.maxOutputTokens ?? 8192,
            }
          : p
      );
      setPresets(updatedPresets);
      savePresets(updatedPresets);
    },
    [presets, settings]
  );

  return {
    presets,
    settings,
    setSettings,
    resetSettings,
    savePreset,
    loadPreset,
    deletePreset,
    updatePreset,
    DEFAULT_SETTINGS,
  };
}
