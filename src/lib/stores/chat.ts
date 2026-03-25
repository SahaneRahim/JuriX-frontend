import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { browser } from '$app/environment';

// Chat message interface
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Array<{
    law_id: number;
    article_id: number;
    law_reference: string;
    article_number: string;
    excerpt: string;
  }>;
  confidence?: number;
}

// Chat state interface
export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  sessionId: string;
}

// Storage key for session ID (sessionStorage for privacy)
const SESSION_STORAGE_KEY = 'jurix-chat-session';

// Generate UUID v4
function generateUUID(): string {
  if (browser && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Get initial session ID from sessionStorage or generate new
function getInitialSessionId(): string {
  if (browser) {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      return stored;
    }
  }
  const newSessionId = generateUUID();
  if (browser) {
    sessionStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
  }
  return newSessionId;
}

// Create the chat store
function createChatStore() {
  const { subscribe, set, update } = writable<ChatState>({
    messages: [],
    isLoading: false,
    sessionId: getInitialSessionId()
  });

  return {
    subscribe,

    // Add a message to the conversation
    addMessage: (message: ChatMessage) => {
      update(state => ({
        ...state,
        messages: [...state.messages, message]
      }));
    },

    // Clear all messages
    clearMessages: () => {
      update(state => ({
        ...state,
        messages: []
      }));
    },

    // Set loading state
    setLoading: (isLoading: boolean) => {
      update(state => ({
        ...state,
        isLoading
      }));
    },

    // Start a new session
    newSession: () => {
      const newSessionId = generateUUID();
      if (browser) {
        sessionStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
      }
      set({
        messages: [],
        isLoading: false,
        sessionId: newSessionId
      });
    },

    // Reset to initial state
    reset: () => {
      if (browser) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
      set({
        messages: [],
        isLoading: false,
        sessionId: generateUUID()
      });
    }
  };
}

// Export the store
export const chatStore = createChatStore();
