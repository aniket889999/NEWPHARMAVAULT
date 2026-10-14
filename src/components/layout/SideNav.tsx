import React from 'react';
import { MessageSquare, Plus, Archive, Settings } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';

const SideNav: React.FC = () => {
  const { 
    conversations, 
    activeConversation,
    createConversation, 
    setActiveConversation 
  } = useChatStore();

  return (
    <div className="w-64 bg-gray-800 text-gray-100 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <button
          onClick={createConversation}
          className="w-full flex items-center justify-between bg-white bg-opacity-10 hover:bg-opacity-20 text-white rounded-lg px-4 py-3 transition-colors"
        >
          <span className="font-medium">New Chat</span>
          <Plus size={18} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <h3 className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Recent Conversations
          </h3>
          
          <div className="space-y-1">
            {conversations.map(conversation => (
              <button
                key={conversation.id}
                onClick={() => setActiveConversation(conversation.id)}
                className={`w-full flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                  activeConversation?.id === conversation.id
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <MessageSquare size={18} className="mr-3 flex-shrink-0" />
                <span className="truncate">{conversation.title}</span>
              </button>
            ))}
            
            {conversations.length === 0 && (
              <p className="text-sm text-gray-500 px-3 py-2">
                No recent conversations
              </p>
            )}
          </div>
        </div>
      </div>
      
      <div className="p-4 border-t border-gray-700">
        <div className="space-y-2">
          <button className="w-full flex items-center px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors">
            <Archive size={18} className="mr-3" />
            <span>Archived Chats</span>
          </button>
          <button className="w-full flex items-center px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors">
            <Settings size={18} className="mr-3" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SideNav;