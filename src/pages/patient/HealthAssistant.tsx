import React, { useEffect, useState } from 'react';
import ChatInterface from '../../components/chat/ChatInterface';
import { useChatStore } from '../../stores/chatStore';
import {
  Bot,
  ShieldCheck,
  Sparkles,
  Pill,
  AlertTriangle,
  Info,
  Clock,
  Layers,
  HeartPulse,
  Search,
  ExternalLink
} from 'lucide-react';

const HealthAssistant: React.FC = () => {
  const { activeConversation, createConversation, sendMessage } = useChatStore();
  const [activeTab, setActiveTab] = useState<'chat' | 'monographs'>('chat');

  useEffect(() => {
    if (!activeConversation) {
      createConversation();
    }
  }, [activeConversation, createConversation]);

  const quickClinicalPrompts = [
    { title: 'Check Drug Interactions', query: 'Can I take Augmentin 625 Duo along with Paracetamol 500mg?', icon: Pill, color: 'text-blue-600 bg-blue-50' },
    { title: 'Explain Dosage & Timing', query: 'What is the ideal meal timing and interval for Metformin 500mg?', icon: Clock, color: 'text-cyan-600 bg-cyan-50' },
    { title: 'Generic Bioequivalents', query: 'What are the cheaper generic chemical equivalents for Crocin 650mg?', icon: Layers, color: 'text-emerald-600 bg-emerald-50' },
    { title: 'Contraindications & Safety', query: 'What are the warnings and contraindications for Azithromycin in heart patients?', icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' }
  ];

  return (
    <div className="flex h-full flex-col bg-slate-50 font-sans">
      {/* Top Clinical Header */}
      <div className="p-5 sm:px-8 bg-white border-b border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Clinical Pharmacology AI Copilot
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active Monograph RAG
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Evidence-grounded medical intelligence cross-referenced against CDSCO, FDA, and active catalogue inventories.
          </p>
        </div>

        {/* Safety & Mode Pill */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Zero-Hallucination Safe Mode</span>
          </div>
        </div>
      </div>

      {/* Quick Clinical Prompts Bar */}
      <div className="px-6 sm:px-8 py-3 bg-white/70 border-b border-slate-200/70 overflow-x-auto flex gap-2.5 scrollbar-none">
        {quickClinicalPrompts.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={i}
              onClick={() => sendMessage(item.query)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-slate-700 hover:text-blue-700 text-xs font-semibold shrink-0 shadow-2xs hover:shadow-xs transition-all"
            >
              <span className={`p-1 rounded-md ${item.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </span>
              <span>{item.title}</span>
            </button>
          );
        })}
      </div>

      {/* Main Chat Interface */}
      <div className="flex-1 overflow-hidden bg-slate-50">
        <ChatInterface />
      </div>
    </div>
  );
};

export default HealthAssistant;
