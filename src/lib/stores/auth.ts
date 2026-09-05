import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Rôles reconnus par le backend.
 *
 * `superadmin` manquait à cette union, alors que le rôle existe en base
 * (`app/schemas/user.py`, motif `^(user|admin|superadmin)$`) et qu'il est testé
 * partout dans le front. Le type déclarait donc impossible un rôle réel.
 *
 * La contradiction n'avait jamais été signalée : sans `tsconfig.json` à la
 * racine, aucun contrôle de types ne tournait. Les appelants qui passent par
 * `["admin","superadmin"].includes(...)` ne levaient rien non plus — ils
 * contournent le typage sur un `string[]` au lieu de le satisfaire.
 */
export type UserRole = 'user' | 'admin' | 'superadmin';

// User type
export interface User {
  /**
   * ENTIER, comme `UserResponse.id` du backend — la valeur vient telle quelle de
   * `POST /auth/login/json` (`login/+page.svelte`).
   *
   * Elle etait declaree `string`. Le type mentait, et il n'a jamais leve
   * d'erreur parce qu'aucun controle ne tournait avant l'ajout du tsconfig. Le
   * cout reel : `/admin/users` masque son bouton de suppression sur le compte de
   * l'operateur par `u.id !== $authStore.user?.id`, une comparaison que TypeScript
   * declarait sans recouvrement possible. Elle fonctionnait par chance, les deux
   * valeurs etant des nombres a l'execution.
   */
  id: number;
  email: string;
  role: UserRole;
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
  const { subscribe, set } = writable<AuthState>(getInitialState());

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

    // updateUser, setLoading et isAdmin ont ete retirees : aucun appelant.
    //
    // isAdmin etait en outre FAUSSE : elle relisait localStorage au lieu de
    // l'etat courant du store, et ne testait que `role === 'admin'`, oubliant
    // 'superadmin' — la contredisant partout ailleurs dans l'application, ou le
    // controle est `["admin", "superadmin"].includes(role)`. L'avoir appelee un
    // jour aurait exclu les super-administrateurs de leur propre interface.
  };
}

// Export the store
export const authStore = createAuthStore();
