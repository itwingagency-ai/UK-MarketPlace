import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin, logout as apiLogout, register as apiRegister } from '../api/auth.api';
import { STORAGE_KEYS } from '../constants';

// ─── State & Reducer ──────────────────────────────────────────────────────
const initialState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,   // true while we hydrate from storage
  error: null,
};

const AUTH_ACTIONS = {
  HYDRATE: 'HYDRATE',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGOUT: 'LOGOUT',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
};

function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.HYDRATE:
      return {
        ...state,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
        isLoading: false,
      };
    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
        error: null,
        isLoading: false,
      };
    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState,
        isLoading: false,
      };
    case AUTH_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };
    case AUTH_ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Hydrate auth state from AsyncStorage on app start
  useEffect(() => {
    const hydrate = async () => {
      try {
        const [accessToken, refreshToken, userJson] = await AsyncStorage.multiGet([
          STORAGE_KEYS.ACCESS_TOKEN,
          STORAGE_KEYS.REFRESH_TOKEN,
          STORAGE_KEYS.USER,
        ]);

        const user = userJson[1] ? JSON.parse(userJson[1]) : null;

        dispatch({
          type: AUTH_ACTIONS.HYDRATE,
          payload: {
            user,
            accessToken: accessToken[1],
            refreshToken: refreshToken[1],
          },
        });
      } catch {
        dispatch({ type: AUTH_ACTIONS.HYDRATE, payload: { user: null, accessToken: null, refreshToken: null } });
      }
    };

    hydrate();
  }, []);

  const persistTokens = async (accessToken, refreshToken, user) => {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.ACCESS_TOKEN, accessToken],
      [STORAGE_KEYS.REFRESH_TOKEN, refreshToken],
      [STORAGE_KEYS.USER, JSON.stringify(user)],
    ]);
  };

  const login = useCallback(async (email, password) => {
    try {
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
      const data = await apiLogin(email, password);
      await persistTokens(data.accessToken, data.refreshToken, data.user);
      dispatch({ type: AUTH_ACTIONS.LOGIN_SUCCESS, payload: data });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed. Please try again.';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: message });
      return { success: false, error: message };
    }
  }, []);

  const register = useCallback(async (name, email, password) => {
    try {
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
      const data = await apiRegister(name, email, password);
      await persistTokens(data.accessToken, data.refreshToken, data.user);
      dispatch({ type: AUTH_ACTIONS.LOGIN_SUCCESS, payload: data });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed. Please try again.';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: message });
      return { success: false, error: message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (state.refreshToken) {
        await apiLogout(state.refreshToken);
      }
    } catch {
      // Ignore logout API errors — always clear local state
    } finally {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER,
      ]);
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  }, [state.refreshToken]);

  const clearError = useCallback(() => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: !!state.user,
        isLoading: state.isLoading,
        error: state.error,
        login,
        register,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
