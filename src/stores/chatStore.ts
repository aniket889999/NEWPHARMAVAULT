import { create } from 'zustand';
import { Conversation, ChatMessage, Medicine, QuestionType } from '../types';
import { getMedicineByName } from '../data/medicines';
import { questionTemplates } from '../data/questions';
import axios from 'axios';
import apiClient from '../api/apiClient';

interface ChatState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  selectedMedicine: Medicine | null;
  isLoading: boolean;

  // Actions
  createConversation: () => void;
  setActiveConversation: (id: string) => void;
  selectMedicine: (medicine: Medicine | null) => void;
  sendMessage: (content: string) => void;
  sendPredefinedQuestion: (questionType: QuestionType) => void;
  sendGeneralHealthQuery: (content: string) => void;
  clearActiveConversation: () => void;
}

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substring(2, 11);

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  selectedMedicine: null,
  isLoading: false,

  createConversation: () => {
    const newConversation: Conversation = {
      id: generateId(),
      title: 'New Conversation',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      type: 'general'
    };

    set(state => ({
      conversations: [newConversation, ...state.conversations],
      activeConversation: newConversation
    }));
  },

  setActiveConversation: (id: string) => {
    const { conversations } = get();
    const conversation = conversations.find(c => c.id === id);
    if (conversation) {
      set({ activeConversation: conversation });
    }
  },

  selectMedicine: (medicine: Medicine | null) => {
    set({ selectedMedicine: medicine });
  },

  sendMessage: async (content: string) => {
    const { activeConversation, selectedMedicine } = get();

    if (!activeConversation) {
      // Create a conversation if none exists
      const newConversation: Conversation = {
        id: generateId(),
        title: content.substring(0, 30) + (content.length > 30 ? '...' : ''),
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        type: 'general'
      };

      set(state => ({
        conversations: [newConversation, ...state.conversations],
        activeConversation: newConversation
      }));

      // Re-run sendMessage now that we have an active conversation
      get().sendMessage(content);
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
      relatedMedicine: selectedMedicine?.id,
    };

    set(state => {
      const updatedConversation = {
        ...state.activeConversation!,
        messages: [...state.activeConversation!.messages, userMessage],
        updatedAt: new Date()
      };

      return {
        activeConversation: updatedConversation,
        conversations: state.conversations.map(c =>
          c.id === updatedConversation.id ? updatedConversation : c
        ),
        isLoading: true
      };
    });

    try {
      // Removed sensitive payload log
      
      const { data } = await apiClient.post(
        '/agents/orchestrate',
        { query: content }
      );
      
      const responseText = data.answer;

      const botMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        relatedMedicine: selectedMedicine?.id,
        agentTrace: data.agentTrace || [],
        safetyWarnings: data.safetyWarnings || [],
        verified: data.verification?.verified,
        confidence: data.confidence,
      };

      set(state => {
        const updatedConversation = {
          ...state.activeConversation!,
          messages: [...state.activeConversation!.messages, botMessage],
          updatedAt: new Date()
        };

        return {
          activeConversation: updatedConversation,
          conversations: state.conversations.map(c =>
            c.id === updatedConversation.id ? updatedConversation : c
          ),
          isLoading: false
        };
      });
    } catch (error: any) {
      console.error("[AI] Message delivery failed");
      
      const errorMessage = error.response?.data?.message || error.message || 'Unknown network error';
      
      const botMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `I'm having trouble connecting to my knowledge base right now. Please try again. If the issue persists, the server might be busy.`,
        timestamp: new Date(),
      };
      
      set(state => {
        const updatedConversation = {
          ...state.activeConversation!,
          messages: [...state.activeConversation!.messages, botMessage],
          updatedAt: new Date()
        };
        return {
          activeConversation: updatedConversation,
          conversations: state.conversations.map(c =>
            c.id === updatedConversation.id ? updatedConversation : c
          ),
          isLoading: false
        };
      });
    }
  },

  sendGeneralHealthQuery: async (content: string) => {
    const { activeConversation, selectedMedicine } = get();

    if (!activeConversation) {
      // Create a conversation if none exists
      const newConversation: Conversation = {
        id: generateId(),
        title: content.substring(0, 30) + (content.length > 30 ? '...' : ''),
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        type: 'general'
      };

      set(state => ({
        conversations: [newConversation, ...state.conversations],
        activeConversation: newConversation
      }));

      // Re-run sendGeneralHealthQuery now that we have an active conversation
      get().sendGeneralHealthQuery(content);
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
      relatedMedicine: selectedMedicine?.id // Typo fix: removed undefined variable
    };

    set(state => {
      const updatedConversation = {
        ...state.activeConversation!,
        messages: [...state.activeConversation!.messages, userMessage],
        updatedAt: new Date()
      };

      return {
        activeConversation: updatedConversation,
        conversations: state.conversations.map(c =>
          c.id === updatedConversation.id ? updatedConversation : c
        ),
        isLoading: true
      };
    });

    try {
      // Removed sensitive request payload log
      
      const historyContext = get().activeConversation?.messages.slice(-5, -1).map(m => ({ role: m.role, text: m.content })) || [];

      const { data } = await apiClient.post(
        '/chat',
        { message: content, medicineId: selectedMedicine?.id, history: historyContext }
      );
      
      const responseText = data.reply;

      const botMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
      };

      set(state => {
        const updatedConversation = {
          ...state.activeConversation!,
          messages: [...state.activeConversation!.messages, botMessage],
          updatedAt: new Date()
        };

        return {
          activeConversation: updatedConversation,
          conversations: state.conversations.map(c =>
            c.id === updatedConversation.id ? updatedConversation : c
          ),
          isLoading: false
        };
      });
    } catch (error: any) {
      console.error("[AI] General health query failed");
      
      const errorMessage = error.response?.data?.message || error.message || 'Unknown network error';
      
      const botMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `I'm having trouble connecting to my knowledge base right now. Please try again. If the issue persists, the server might be busy.`,
        timestamp: new Date(),
      };
      
      set(state => {
        const updatedConversation = {
          ...state.activeConversation!,
          messages: [...state.activeConversation!.messages, botMessage],
          updatedAt: new Date()
        };
        return {
          activeConversation: updatedConversation,
          conversations: state.conversations.map(c =>
            c.id === updatedConversation.id ? updatedConversation : c
          ),
          isLoading: false
        };
      });
    }
  },

  sendPredefinedQuestion: (questionType: QuestionType) => {
    const { selectedMedicine } = get();
    if (!selectedMedicine) {
      return;
    }

    const template = questionTemplates.find(t => t.id === questionType);
    if (!template) {
      return;
    }

    get().sendMessage(template.text);
  },

  clearActiveConversation: () => {
    set({ activeConversation: null });
  }
}));