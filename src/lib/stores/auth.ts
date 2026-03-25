import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// User type
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  name?: string;
}

// Auth state type
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Storage keys
const TOKEN_STORAGE_KEY = 'jurix-auth-token';
const USER_STORAGE_KEY = 'jurix-auth-user';

// Get initial state from localStorage
function getInitialState(): AuthState {
  if (browser) {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const userStr = localStorage.getItem(USER_STORAGE_KEY);

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        return {
          user,
          token,
          isAuthenticated: true,
          isLoading: false
        };
      } catch (e) {
        console.error('Failed to parse user data:', e);
      }
    }
  }

  return {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false
  };
}

// Create the auth store
function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(getInitialState());

  return {
    subscribe,

    // Login action
    login: (user: User, token: string) => {
      if (browser) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      }
      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false
      });
    },

    // Logout action
    logout: () => {
      if (browser) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
      }
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false
      });
    },

    // Update user info
    updateUser: (user: User) => {
      if (browser) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      }
      update(state => ({
        ...state,
        user
      }));
    },

    // Set loading state
    setLoading: (isLoading: boolean) => {
      update(state => ({
        ...state,
        isLoading
      }));
    },

    // Check if user has admin role
    isAdmin: (): boolean => {
      const state = getInitialState();
      return state.user?.role === 'admin';
    }
  };
}

// Export the store
export const authStore = createAuthStore();
