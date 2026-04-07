/**
 * Centralized API configuration for JuriX frontend.
 *
 * Set VITE_API_URL in your .env file to point to the backend.
 * - Development : http://localhost:8000
 * - Production  : https://jurix-api.onrender.com  (or your Render URL)
 */
export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';

export const API_BASE_URL = `${API_URL}/api/v1`;

/**
 * WebSocket base URL derived from API_URL.
 * https:// → wss://   |   http:// → ws://
 */
export const WS_URL: string = API_URL.replace('https://', 'wss://').replace(
  'http://',
  'ws://'
);

export const WS_BASE_URL = `${WS_URL}/api/v1`;
