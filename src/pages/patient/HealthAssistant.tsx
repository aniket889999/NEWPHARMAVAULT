import React, { useEffect } from 'react';
import ChatInterface from '../../components/chat/ChatInterface';
import { useChatStore } from '../../stores/chatStore';

const HealthAssistant: React.FC = () => {
  const { activeConversation, createConversation } = useChatStore();

  useEffect(() => {
    if (!activeConversation) {
      createConversation();
    }
  }, [activeConversation, createConversation]);

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Health Assistant</h1>
        <p className="text-gray-500 mt-1">Consult our AI medical assistant for information regarding medicines, dosages, and general health queries.</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatInterface />
      </div>
    </div>
  );
};

export default HealthAssistant;
