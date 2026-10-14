import React from 'react';
import { useAccessibilityStore } from '../../stores/accessibilityStore';
import { Ear, Eye, Mic, MessageSquare, ToggleRight, ToggleLeft } from 'lucide-react';

const AccessibilitySettings: React.FC = () => {
  const a11y = useAccessibilityStore();

  return (
    <div className="space-y-6 animate-fade-in pb-10 max-w-4xl mx-auto">
      <div className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 text-white">
        <h1 className="text-2xl font-black flex items-center">
          <Eye className="text-indigo-400 mr-3" size={28} />
          Accessibility & Localization
        </h1>
        <p className="text-sm text-slate-400 font-medium mt-1">Customize UI, Voice, and Multilingual preferences.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center">
          <MessageSquare className="text-indigo-500 mr-2" size={20} />
          Language Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['en', 'hi', 'mr'].map(lang => (
            <button
              key={lang}
              onClick={() => a11y.setPreferredLanguage(lang)}
              className={`p-4 rounded-xl border-2 font-bold flex flex-col items-center justify-center transition-all ${
                a11y.preferredLanguage === lang 
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                : 'border-slate-100 hover:border-indigo-200 text-slate-600 bg-white'
              }`}
            >
              <span className="text-2xl mb-2">{lang === 'en' ? '🇺🇸' : '🇮🇳'}</span>
              <span>{lang === 'en' ? 'English' : lang === 'hi' ? 'हिंदी (Hindi)' : 'मराठी (Marathi)'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
           <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center">
            <Eye className="text-emerald-500 mr-2" size={20} />
            Visual Accessibility
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <h4 className="font-bold text-slate-700">High Contrast Mode</h4>
                <p className="text-xs text-slate-500">Increases text legibility and color contrast.</p>
              </div>
              <button onClick={() => a11y.setHighContrast(!a11y.highContrast)}>
                {a11y.highContrast ? <ToggleRight size={32} className="text-indigo-500" /> : <ToggleLeft size={32} className="text-slate-300" />}
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <h4 className="font-bold text-slate-700">Large Text</h4>
                <p className="text-xs text-slate-500">Increases font sizes across the platform.</p>
              </div>
              <button onClick={() => a11y.setLargeText(!a11y.largeText)}>
                {a11y.largeText ? <ToggleRight size={32} className="text-indigo-500" /> : <ToggleLeft size={32} className="text-slate-300" />}
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <h4 className="font-bold text-slate-700">Simplified UI (Low Literacy)</h4>
                <p className="text-xs text-slate-500">Removes complex charts, uses icon-heavy designs.</p>
              </div>
              <button onClick={() => a11y.setSimplifiedMode(!a11y.simplifiedMode)}>
                {a11y.simplifiedMode ? <ToggleRight size={32} className="text-indigo-500" /> : <ToggleLeft size={32} className="text-slate-300" />}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
           <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center">
            <Ear className="text-orange-500 mr-2" size={20} />
            Voice & Audio
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <h4 className="font-bold text-slate-700">Text-to-Speech (TTS)</h4>
                <p className="text-xs text-slate-500">Allow AI assistant to speak responses aloud.</p>
              </div>
              <button onClick={() => a11y.setTtsEnabled(!a11y.ttsEnabled)}>
                {a11y.ttsEnabled ? <ToggleRight size={32} className="text-indigo-500" /> : <ToggleLeft size={32} className="text-slate-300" />}
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <h4 className="font-bold text-slate-700">Voice-First Mode</h4>
                <p className="text-xs text-slate-500">Auto-listen on app open, large microphone button.</p>
              </div>
              <button onClick={() => a11y.setVoiceFirst(!a11y.voiceFirst)}>
                {a11y.voiceFirst ? <ToggleRight size={32} className="text-indigo-500" /> : <ToggleLeft size={32} className="text-slate-300" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessibilitySettings;
