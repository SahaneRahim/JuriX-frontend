import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { chatStore, type ChatMessage } from './chat';

// Mock browser environment
vi.stubGlobal('sessionStorage', {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
});

// Identifiant different a chaque appel : la doublure renvoyait une constante,
// ce qui rendait impossible de verifier que newSession() change de session.
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => `test-uuid-${++uuidCounter}`)
});

describe('chat store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatStore.reset();
  });

  it('should have initial empty messages array', () => {
    const state = get(chatStore);
    expect(state.messages).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.sessionId).toBeTruthy();
  });

  it('should add user message correctly', () => {
    const userMessage: ChatMessage = {
      id: '1',
      role: 'user',
      content: 'Test question',
      timestamp: new Date()
    };

    chatStore.addMessage(userMessage);
    const state = get(chatStore);

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toEqual(userMessage);
  });

  it('should add assistant message with sources', () => {
    const assistantMessage: ChatMessage = {
      id: '2',
      role: 'assistant',
      content: 'Test answer',
      timestamp: new Date(),
      sources: [
        {
          law_id: 1,
          article_id: 10,
          law_reference: 'LOI-2024-001',
          article_number: '5',
          excerpt: 'Article excerpt...'
        }
      ],
      confidence: 0.95
    };

    chatStore.addMessage(assistantMessage);
    const state = get(chatStore);

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].sources).toHaveLength(1);
    expect(state.messages[0].confidence).toBe(0.95);
  });

  it('should add multiple messages in order', () => {
    const message1: ChatMessage = {
      id: '1',
      role: 'user',
      content: 'Question 1',
      timestamp: new Date()
    };

    const message2: ChatMessage = {
      id: '2',
      role: 'assistant',
      content: 'Answer 1',
      timestamp: new Date()
    };

    chatStore.addMessage(message1);
    chatStore.addMessage(message2);

    const state = get(chatStore);
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0].role).toBe('user');
    expect(state.messages[1].role).toBe('assistant');
  });

  it('should clear messages correctly', () => {
    const message: ChatMessage = {
      id: '1',
      role: 'user',
      content: 'Test',
      timestamp: new Date()
    };

    chatStore.addMessage(message);
    expect(get(chatStore).messages).toHaveLength(1);

    chatStore.clearMessages();
    expect(get(chatStore).messages).toHaveLength(0);
  });

  it('should set loading state', () => {
    expect(get(chatStore).isLoading).toBe(false);

    chatStore.setLoading(true);
    expect(get(chatStore).isLoading).toBe(true);

    chatStore.setLoading(false);
    expect(get(chatStore).isLoading).toBe(false);
  });

  it('should generate new session on newSession()', () => {
    const initialState = get(chatStore);
    const initialSessionId = initialState.sessionId;

    // Add some messages
    chatStore.addMessage({
      id: '1',
      role: 'user',
      content: 'Test',
      timestamp: new Date()
    });

    // Start new session
    chatStore.newSession();
    const newState = get(chatStore);

    expect(newState.sessionId).not.toBe(initialSessionId);
    expect(newState.messages).toHaveLength(0);
    expect(newState.isLoading).toBe(false);
  });

  it('should reset to initial state', () => {
    // Add messages and set loading
    chatStore.addMessage({
      id: '1',
      role: 'user',
      content: 'Test',
      timestamp: new Date()
    });
    chatStore.setLoading(true);

    chatStore.reset();
    const state = get(chatStore);

    expect(state.messages).toHaveLength(0);
    expect(state.isLoading).toBe(false);
    expect(state.sessionId).toBeTruthy();
  });

  it('should maintain session ID when adding messages', () => {
    const initialSessionId = get(chatStore).sessionId;

    chatStore.addMessage({
      id: '1',
      role: 'user',
      content: 'Test',
      timestamp: new Date()
    });

    const afterAddSessionId = get(chatStore).sessionId;
    expect(afterAddSessionId).toBe(initialSessionId);
  });
});
