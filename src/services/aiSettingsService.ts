export type GenAIProvider = 'none' | 'gemini' | 'groq' | 'ollama' | 'openai';

export interface AISettings {
  provider: GenAIProvider;
  geminiKey: string;
  groqKey: string;
  openaiKey: string;
  ollamaModel: string;
}

export const AI_STORAGE_KEY = 'noterip_ai_settings_v1';

export function loadAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(AI_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        provider: parsed.provider || 'none',
        geminiKey: parsed.geminiKey || '',
        groqKey: parsed.groqKey || '',
        openaiKey: parsed.openaiKey || '',
        ollamaModel: parsed.ollamaModel || 'llama3',
      };
    }
  } catch {
    // ignore
  }
  return {
    provider: 'none',
    geminiKey: '',
    groqKey: '',
    openaiKey: '',
    ollamaModel: 'llama3',
  };
}

export function saveAISettings(settings: AISettings): void {
  try {
    localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save AI settings', e);
  }
}
