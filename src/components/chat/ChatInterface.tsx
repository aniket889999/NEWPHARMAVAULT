import React, { useState, useRef, useEffect } from 'react';
import { Send, Stethoscope, Mic, MicOff, Search, Info, ShieldAlert, FileText, Pill } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useAccessibilityStore } from '../../stores/accessibilityStore';
import ChatMessage from './ChatMessage';

const ChatInterface: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showEmergencyWarning, setShowEmergencyWarning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const { 
    activeConversation, 
    sendMessage, 
    isLoading
  } = useChatStore();
  const a11y = useAccessibilityStore();

  const suggestionChips = a11y.preferredLanguage === 'hi' ? [
    { text: "दवा की उपलब्धता की जांच करें", icon: <Search size={16} /> },
    { text: "पैरासिटामोल के क्या दुष्प्रभाव हैं?", icon: <ShieldAlert size={16} /> },
    { text: "डोलो 650 और क्रोसिन की तुलना करें", icon: <Pill size={16} /> },
  ] : a11y.preferredLanguage === 'mr' ? [
    { text: "औषधाची उपलब्धता तपासा", icon: <Search size={16} /> },
    { text: "पॅरासिटामॉलचे दुष्परिणाम काय आहेत?", icon: <ShieldAlert size={16} /> },
    { text: "डोलो 650 आणि क्रोसिनची तुलना करा", icon: <Pill size={16} /> },
  ] : [
    { text: "Check medicine availability", icon: <Search size={16} /> },
    { text: "What are the side effects of Paracetamol?", icon: <ShieldAlert size={16} /> },
    { text: "Compare Dolo 650 and Crocin", icon: <Pill size={16} /> },
    { text: "Can I take antibiotics for a cold?", icon: <Info size={16} /> },
    { text: "Help me upload a prescription", icon: <FileText size={16} /> },
  ];
  
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeConversation?.messages, isLoading]);
  
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    // Voice First Auto-start
    if (a11y.voiceFirst && !isRecording) {
      // Delay slightly to ensure permissions can be requested
      setTimeout(() => {
        toggleRecording();
      }, 500);
    }
  }, [a11y.voiceFirst]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    
    if (showEmergencyWarning) {
      alert("🚨 Seek medical help immediately. Dial 112 / 108 / 911.");
      return; // Do not hit backend AI during emergencies
    }
    
    sendMessage(inputValue);
    setInputValue('');
    setShowEmergencyWarning(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputValue(val);
    
    // Emergency Phrase Detection
    const emergencyRegex = /(chest pain|breathing difficulty|overdose|severe allergic reaction|unconscious|seizure|poisoning|suicidal thoughts)/i;
    if (emergencyRegex.test(val)) {
      setShowEmergencyWarning(true);
    } else if (val === '') {
      setShowEmergencyWarning(false);
    }
  };

  const handleChipClick = (text: string) => {
    sendMessage(text);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  const toggleRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }
    
    if (isRecording) {
      setIsRecording(false);
      return;
    }
    
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false; // Stop listening after one result
    
    recognition.onstart = () => setIsRecording(true);
    
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      setInputValue(transcript);
      
      // Check emergency mode on voice input too
      const emergencyRegex = /(chest pain|breathing difficulty|overdose|severe allergic reaction|unconscious|seizure|poisoning|suicidal thoughts)/i;
      if (emergencyRegex.test(transcript)) {
        setShowEmergencyWarning(true);
      }
    };
    
    recognition.onerror = (event: any) => {
      setIsRecording(false);
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone permissions.');
      } else if (event.error === 'no-speech') {
        alert('Voice not detected. Please try again.');
      } else {
        alert(`Microphone error: ${event.error}`);
      }
    };
    
    recognition.onend = () => setIsRecording(false);
    
    try {
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsRecording(false);
    }
  };
  
  if (!activeConversation) return null;
  
  return (
    <div className="flex flex-col h-full bg-white max-w-5xl mx-auto w-full">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto py-6 px-4 md:px-8">
        <div className="mx-auto space-y-6 max-w-4xl">
          {activeConversation.messages.length === 0 ? (
            <div className="text-center py-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-50 mb-6 shadow-sm border border-blue-100">
                <Stethoscope size={40} className="text-primary-600" />
              </div>
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">
                {a11y.preferredLanguage === 'hi' ? 'नमस्ते, मैं फ़ार्मावॉल्ट हेल्थ असिस्टेंट हूँ।' : a11y.preferredLanguage === 'mr' ? 'नमस्कार, मी फार्मावॉल्ट हेल्थ असिस्टंट आहे.' : 'Hi, I’m PharmaVault Health Assistant.'}
              </h2>
              <p className="text-lg text-gray-500 mb-8 max-w-2xl mx-auto">
                {a11y.preferredLanguage === 'hi' ? 'मैं आज आपकी कैसे मदद कर सकता हूँ? मुझसे दवाओं, उपलब्धता, या सामान्य स्वास्थ्य मार्गदर्शन के बारे में पूछें।' : a11y.preferredLanguage === 'mr' ? 'मी आज तुम्हाला कशी मदत करू शकतो? मला औषधे, उपलब्धता किंवा सामान्य आरोग्य मार्गदर्शनाबद्दल विचारा.' : 'How can I help you today? Ask me about medicines, check pharmacy availability, or get general health guidance.'}
              </p>
              
              <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
                {suggestionChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleChipClick(chip.text)}
                    className="flex items-center gap-2 px-5 py-3 rounded-full border border-gray-200 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 transition-all shadow-sm text-sm font-medium"
                  >
                    {chip.icon}
                    {chip.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Initial Greeting in History */}
              <div className="flex w-full mb-6 mt-2">
                <div className="flex-shrink-0 mr-4">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <Stethoscope size={20} className="text-primary-600" />
                  </div>
                </div>
                <div className="max-w-[85%] bg-gray-50 border border-gray-100 text-gray-800 rounded-2xl rounded-tl-sm px-5 py-3">
                  <p>{a11y.preferredLanguage === 'hi' ? 'नमस्ते, मैं फ़ार्मावॉल्ट हेल्थ असिस्टेंट हूँ। मैं आज आपकी कैसे मदद कर सकता हूँ?' : a11y.preferredLanguage === 'mr' ? 'नमस्कार, मी फार्मावॉल्ट हेल्थ असिस्टंट आहे. मी आज तुम्हाला कशी मदत करू शकतो?' : 'Hi, I’m PharmaVault Health Assistant. How can I help you today?'}</p>
                </div>
              </div>

              {activeConversation.messages.map(message => (
                <ChatMessage key={message.id} message={message} />
              ))}
            </>
          )}
          
          {isLoading && (
            <div className="flex w-full animate-in fade-in">
              <div className="flex-shrink-0 mr-4">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <Stethoscope size={20} className="text-primary-600" />
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-5 py-4 flex items-center text-gray-500 text-sm font-medium">
                <span>AI is thinking</span>
                <div className="flex space-x-1.5 ml-2 mt-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>
      
      {/* Input Area */}
      <div className="bg-white px-4 py-6 md:px-8">
        <div className="max-w-4xl mx-auto relative">
          
          {showEmergencyWarning && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-600 p-4 rounded-r-lg shadow-sm animate-in fade-in slide-in-from-bottom-2">
              <div className="flex">
                <div className="flex-shrink-0">
                  <ShieldAlert className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-bold text-red-800">EMERGENCY MEDICAL WARNING</h3>
                  <div className="mt-1 text-sm text-red-700">
                    <p>You mentioned potentially life-threatening symptoms. Please <strong>DO NOT</strong> rely on AI for emergencies.</p>
                    <p className="mt-1 font-bold">Call your local emergency services (112 / 108 / 911) or visit the nearest hospital immediately.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className={`relative rounded-2xl shadow-sm border overflow-hidden focus-within:ring-2 transition-all ${
              showEmergencyWarning 
                ? 'border-red-300 focus-within:ring-red-500 focus-within:border-red-500' 
                : 'border-gray-200 focus-within:ring-primary-500 focus-within:border-primary-500'
            }`}>
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? "Listening..." : a11y.preferredLanguage === 'hi' ? "दवाओं के बारे में पूछें..." : a11y.preferredLanguage === 'mr' ? "औषधांबद्दल विचारा..." : "Ask about medicines, side effects, availability, or prescriptions..."}
              className={`block w-full pl-5 pr-24 py-4 bg-transparent border-0 resize-none placeholder:text-gray-400 focus:ring-0 ${a11y.voiceFirst ? 'text-2xl' : 'text-base'}`}
              rows={1}
              style={{ minHeight: a11y.voiceFirst ? '80px' : '60px' }}
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleRecording}
                className={`p-2.5 rounded-full transition-colors ${
                  isRecording 
                    ? 'text-red-600 bg-red-50 animate-pulse scale-110' 
                    : a11y.voiceFirst ? 'text-white bg-indigo-600 scale-125 mx-2' : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
                }`}
                title={isRecording ? "Stop recording" : "Voice input"}
              >
                {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="p-2.5 rounded-full bg-primary-600 text-white disabled:bg-gray-100 disabled:text-gray-400 transition-colors hover:bg-primary-700"
              >
                <Send size={20} />
              </button>
            </div>
            </div>
            <p className="mt-3 text-xs text-center text-gray-500">
              PharmaVault provides general guidance and cannot replace a doctor. In an emergency, please seek immediate medical attention.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;