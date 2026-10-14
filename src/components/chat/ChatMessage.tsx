import React, { useState } from 'react';
import { Pill, User, ShieldCheck, ShieldAlert, Activity, ChevronDown, ChevronUp, ArrowRight, Share2, BrainCircuit, Volume2, VolumeX } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '../../types';
import ReactMarkdown from 'react-markdown';
import { useChatStore } from '../../stores/chatStore';
import { useAccessibilityStore } from '../../stores/accessibilityStore';

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const { sendMessage } = useChatStore();
  const a11y = useAccessibilityStore();
  const [showTrace, setShowTrace] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speakContent = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(displayContent.replace(/\*\*/g, ''));
    if (a11y.preferredLanguage === 'hi') utterance.lang = 'hi-IN';
    else if (a11y.preferredLanguage === 'mr') utterance.lang = 'mr-IN';
    else utterance.lang = 'en-US';
    
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };
  
  // Extract suggestions if any
  let displayContent = message.content;
  let suggestions: string[] = [];
  
  if (!isUser && displayContent.includes('SUGGESTIONS:')) {
    const parts = displayContent.split('SUGGESTIONS:');
    displayContent = parts[0].trim();
    const suggestionsString = parts[1].trim();
    suggestions = suggestionsString.split('|').map(s => s.trim()).filter(s => s.length > 0);
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start max-w-[85%] ${isUser ? 'flex-row-reverse' : ''}`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 ${isUser ? 'ml-4' : 'mr-4'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isUser
              ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white'
              : 'bg-gradient-to-br from-secondary-500 to-secondary-600 text-white shadow-md'
            }`}>
            {isUser ? <User size={20} /> : <Activity size={20} />}
          </div>
        </div>

        {/* Message Content */}
        <div className="flex flex-col gap-2 w-full">
          {!isUser && message.showTrustLayer !== false && (message.confidence !== undefined && message.confidence !== null && message.verified !== 'not_applicable') && (
            <div className="flex items-center gap-2 mb-1 px-1">
              {message.verified === true ? (
                <span className="flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase tracking-wider">
                  <ShieldCheck size={12} className="mr-1" /> AI Verified
                </span>
              ) : message.verified === 'partially' ? (
                <span className="flex items-center text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100 uppercase tracking-wider">
                  <ShieldAlert size={12} className="mr-1" /> Partially Verified
                </span>
              ) : (
                <span className="flex items-center text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 uppercase tracking-wider">
                  <ShieldAlert size={12} className="mr-1" /> Unverified
                </span>
              )}
              {message.confidence > 0 && (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  Confidence: {message.confidence}%
                </span>
              )}
            </div>
          )}

          <div className={`px-6 py-4 rounded-2xl shadow-sm ${isUser
              ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white'
              : 'bg-white text-gray-900 border border-slate-100'
            }`}>
            
            {/* Safety Warnings */}
            {!isUser && message.safetyWarnings && message.safetyWarnings.length > 0 && (
              <div className="mb-4 space-y-2">
                {message.safetyWarnings.map((warning, idx) => (
                  <div key={idx} className={`p-3 rounded-lg text-xs font-bold flex items-start border ${warning.includes('EMERGENCY') ? 'bg-red-50 text-red-800 border-red-200' : 'bg-orange-50 text-orange-800 border-orange-200'}`}>
                    <ShieldAlert size={14} className="mr-2 mt-0.5 shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}

            <div className={`prose prose-sm max-w-none ${isUser ? 'prose-invert' : 'prose-slate'}`}>
              {displayContent.includes('**') ? (
                <ReactMarkdown>{displayContent}</ReactMarkdown>
              ) : (
                displayContent.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < displayContent.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))
              )}
            </div>

            {/* Dynamic Suggestion Buttons */}
            {suggestions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(suggestion)}
                    className="px-3 py-1.5 text-xs font-medium rounded-full bg-white text-primary-600 border border-primary-200 hover:bg-primary-50 transition-colors shadow-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* TTS Button */}
            {!isUser && a11y.ttsEnabled && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={speakContent}
                  className={`p-1.5 rounded-full border transition-colors ${isSpeaking ? 'bg-indigo-100 border-indigo-200 text-indigo-700 animate-pulse' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-indigo-600'}`}
                  title={isSpeaking ? "Stop Speaking" : "Read Aloud"}
                >
                  {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              </div>
            )}

            {/* Agent Trace & XAI Toggle */}
            {!isUser && message.showTrustLayer !== false && (message.agentTrace || message.explanation) && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <button 
                  onClick={() => setShowTrace(!showTrace)}
                  className="flex items-center text-[11px] font-bold text-slate-400 hover:text-indigo-500 transition-colors uppercase tracking-wider"
                >
                  {showTrace ? <ChevronUp size={14} className="mr-1" /> : <ChevronDown size={14} className="mr-1" />}
                  {showTrace ? 'Hide AI Reasoning & Trace' : 'View AI Reasoning & Trace'}
                </button>
                
                {showTrace && (
                  <div className="mt-4 space-y-4">
                    {/* Explainability Engine Block */}
                    {message.explanation && (
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Activity size={16} className="text-indigo-500" />
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Explainability Engine</h4>
                        </div>
                        
                        {/* GraphRAG Visualization */}
                        {message.explanation.graphRelationships && message.explanation.graphRelationships.length > 0 && (
                          <div className="mb-4 bg-white p-3 rounded-lg border border-indigo-100">
                            <h5 className="text-[10px] font-bold text-indigo-400 uppercase flex items-center mb-2"><Share2 size={12} className="mr-1" /> Graph Knowledge</h5>
                            <div className="space-y-3">
                              {message.explanation.graphRelationships.map((rel, idx) => (
                                <div key={idx} className="flex flex-wrap items-center text-[11px] font-medium gap-1.5">
                                  <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded shadow-sm border border-indigo-100">{rel.name}</span>
                                  <ArrowRight size={12} className="text-slate-300" />
                                  <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded">Generic: {rel.generic}</span>
                                  
                                  {rel.treats.length > 0 && (
                                    <>
                                      <ArrowRight size={12} className="text-slate-300" />
                                      <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded">Treats: {rel.treats.join(', ')}</span>
                                    </>
                                  )}
                                  
                                  {rel.sideEffects.length > 0 && (
                                    <>
                                      <ArrowRight size={12} className="text-slate-300" />
                                      <span className="bg-red-50 text-red-700 px-2 py-1 rounded">Risks: {rel.sideEffects.join(', ')}</span>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Patient Intelligence Block */}
                        {message.explanation.patientIntelligenceData && (
                          <div className="mb-4 bg-white p-3 rounded-lg border border-emerald-100">
                            <h5 className="text-[10px] font-bold text-emerald-500 uppercase flex items-center mb-2"><BrainCircuit size={12} className="mr-1" /> Patient Intelligence</h5>
                            <div className="space-y-3 text-[11px]">
                              {message.explanation.patientIntelligenceData.adherenceScore && (
                                <div className="flex justify-between items-center bg-emerald-50 p-2 rounded border border-emerald-100">
                                  <span className="font-bold text-emerald-700">Adherence Score</span>
                                  <span className="font-black text-emerald-600">{message.explanation.patientIntelligenceData.adherenceScore.currentScore}/100 ({message.explanation.patientIntelligenceData.adherenceScore.trend})</span>
                                </div>
                              )}
                              
                              {message.explanation.patientIntelligenceData.refillRisks && message.explanation.patientIntelligenceData.refillRisks.length > 0 && (
                                <div className="bg-orange-50 p-2 rounded border border-orange-100">
                                  <span className="font-bold text-orange-700 block mb-1">Refill Risks:</span>
                                  {message.explanation.patientIntelligenceData.refillRisks.map((r: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-orange-600">
                                      <span>{r.medicine}</span>
                                      <span className="font-bold">{r.riskLevel} Risk</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {message.explanation.patientIntelligenceData.recentTimeline && message.explanation.patientIntelligenceData.recentTimeline.length > 0 && (
                                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                  <span className="font-bold text-slate-700 block mb-1">Recent Timeline:</span>
                                  <ul className="space-y-1">
                                    {message.explanation.patientIntelligenceData.recentTimeline.map((t: any, idx: number) => (
                                      <li key={idx} className="text-slate-600 flex justify-between">
                                        <span className="capitalize">{t.type.replace(/_/g, ' ')}</span>
                                        <span className="font-medium">{t.medicine}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Why this answer? */}
                        <div className="mb-4">
                          <h5 className="text-[11px] font-bold text-slate-500 uppercase mb-2">Why this answer?</h5>
                          <ul className="space-y-1.5">
                            {message.explanation.reasoningSteps.map((step, idx) => (
                              <li key={idx} className="text-xs text-slate-600 flex items-start">
                                <span className="text-indigo-400 mr-2 mt-0.5">•</span>
                                {step}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Confidence Breakdown */}
                        <div className="mb-4">
                          <h5 className="text-[11px] font-bold text-slate-500 uppercase mb-2">Confidence Breakdown</h5>
                          <div className="space-y-2">
                            {Object.entries(message.explanation.confidenceBreakdown).filter(([k]) => k !== 'finalConfidence').map(([key, value]) => (
                              <div key={key} className="flex items-center text-xs">
                                <span className="w-32 text-slate-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                <div className="flex-1 bg-slate-200 rounded-full h-1.5 mx-3">
                                  <div className="bg-indigo-400 h-1.5 rounded-full" style={{ width: `${value}%` }}></div>
                                </div>
                                <span className="w-8 text-right text-slate-500 font-mono">{value as number}%</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Phase 11 Safety Engine Block */}
                        {message.explanation.safetyData && (
                          <div className={`mt-4 p-4 rounded-xl border ${message.explanation.safetyData.reviewRequired ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center">
                                <ShieldAlert size={14} className="mr-1.5" /> 
                                Safety & Verification Engine
                              </h5>
                              {message.explanation.safetyData.reviewRequired && (
                                <span className="text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">Human Review Required</span>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div className="bg-white p-2 rounded border border-slate-100">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Medical Risk Class</span>
                                <span className={`text-xs font-black ${message.explanation.safetyData.riskClass === 'Emergency Risk' ? 'text-red-600' : message.explanation.safetyData.riskClass === 'General Info' ? 'text-emerald-600' : 'text-orange-500'}`}>{message.explanation.safetyData.riskClass}</span>
                              </div>
                              <div className="bg-white p-2 rounded border border-slate-100">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Hallucination Risk</span>
                                <span className={`text-xs font-black ${message.explanation.safetyData.hallucinationRisk === 'High' ? 'text-red-600' : message.explanation.safetyData.hallucinationRisk === 'Medium' ? 'text-orange-500' : 'text-emerald-600'}`}>{message.explanation.safetyData.hallucinationRisk}</span>
                              </div>
                            </div>

                            {message.explanation.safetyData.contradictionFlags && message.explanation.safetyData.contradictionFlags.length > 0 && (
                              <div className="mb-3 bg-red-100/50 p-2 rounded border border-red-200">
                                <span className="text-[10px] font-bold text-red-800 uppercase block mb-1">Contradictions Detected</span>
                                <ul className="space-y-1">
                                  {message.explanation.safetyData.contradictionFlags.map((flag: string, i: number) => (
                                    <li key={i} className="text-xs text-red-700 flex items-start">
                                      <span className="mr-1">•</span>{flag}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {message.explanation.safetyData.unsupportedClaims && message.explanation.safetyData.unsupportedClaims.length > 0 && (
                              <div className="mb-3 bg-orange-50 p-2 rounded border border-orange-100">
                                <span className="text-[10px] font-bold text-orange-800 uppercase block mb-1">Unsupported AI Claims</span>
                                <ul className="space-y-1">
                                  {message.explanation.safetyData.unsupportedClaims.map((claim: any, i: number) => (
                                    <li key={i} className="text-[11px] text-orange-700 font-medium">
                                      <span className="font-bold">[{claim.type}]</span> {claim.entity}: {claim.claim}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {message.explanation.safetyData.calibrationReason && (
                              <div className="text-[10px] text-slate-500 italic bg-white p-2 rounded border border-slate-100">
                                <span className="font-bold mr-1">Confidence Calibration:</span> 
                                {message.explanation.safetyData.calibrationReason}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Evidence Sources */}
                        <div className="mt-4">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Evidence Sources</h5>
                          <div className="flex gap-1.5 flex-wrap">
                            {message.explanation.evidenceSources.length > 0 ? message.explanation.evidenceSources.map((source, idx) => (
                              <span key={idx} className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-1 rounded shadow-sm border border-indigo-100">{source}</span>
                            )) : <span className="text-xs text-slate-500">None</span>}
                          </div>
                        </div>
                        
                        {/* Disclaimer */}
                        {message.explanation.disclaimer && (
                          <div className="mt-3 text-[10px] text-slate-400 italic">
                            {message.explanation.disclaimer}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Agent Trace Timeline */}
                    {message.agentTrace && message.agentTrace.length > 0 && (
                      <div>
                        <h5 className="text-[11px] font-bold text-slate-500 uppercase mb-2 ml-1">Agent Timeline</h5>
                        <div className="space-y-1.5">
                          {message.agentTrace.map((trace, idx) => (
                            <div key={idx} className="text-[11px] font-mono text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                              <span className="text-indigo-400 mr-2">[{idx + 1}]</span>
                              {trace}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;