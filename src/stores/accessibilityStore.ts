import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AccessibilityState {
  highContrast: boolean;
  largeText: boolean;
  voiceFirst: boolean;
  simplifiedMode: boolean;
  preferredLanguage: string;
  ttsEnabled: boolean;
  setHighContrast: (v: boolean) => void;
  setLargeText: (v: boolean) => void;
  setVoiceFirst: (v: boolean) => void;
  setSimplifiedMode: (v: boolean) => void;
  setPreferredLanguage: (lang: string) => void;
  setTtsEnabled: (v: boolean) => void;
}

export const useAccessibilityStore = create<AccessibilityState>()(
  persist(
    (set) => ({
      highContrast: false,
      largeText: false,
      voiceFirst: false,
      simplifiedMode: false,
      preferredLanguage: 'en',
      ttsEnabled: true,
      setHighContrast: (v) => set({ highContrast: v }),
      setLargeText: (v) => set({ largeText: v }),
      setVoiceFirst: (v) => set({ voiceFirst: v }),
      setSimplifiedMode: (v) => set({ simplifiedMode: v }),
      setPreferredLanguage: (lang) => set({ preferredLanguage: lang }),
      setTtsEnabled: (v) => set({ ttsEnabled: v })
    }),
    {
      name: 'pharmavault-a11y'
    }
  )
);
