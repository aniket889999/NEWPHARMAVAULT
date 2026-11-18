import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguageStore, Language } from '../../i18n';

/** English / हिन्दी switch (remembered on this device). */
const LanguageSwitch: React.FC = () => {
  const { language, setLanguage } = useLanguageStore();
  return (
    <label className="flex items-center gap-1 text-[11px] font-medium text-slate-600" title="Language / भाषा">
      <Languages className="w-4 h-4 text-slate-500" aria-hidden="true" />
      <span className="sr-only">Language</span>
      <select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value as Language)} className="bg-transparent border border-slate-200 rounded-md px-1.5 py-0.5">
        <option value="en">English</option>
        <option value="hi">हिन्दी</option>
      </select>
    </label>
  );
};

export default LanguageSwitch;
