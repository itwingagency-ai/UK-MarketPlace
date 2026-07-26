import React, { createContext, useCallback, useContext, useEffect, useReducer } from 'react';
import { useAuth } from './AuthContext';
import * as CartAPI from '../api/cart.api';

// ─── State & Reducer ──────────────────────────────────────────────────────
const initialState = {
  items: [],
  byStore: [],
  total: 0,
  itemCount: 0,
  storeId: null,
  isLoading: false,
  error: null,
};

const CART_ACTIONS = {
  SET_CART: 'SET_CART',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR: 'CLEAR',
};

function cartReducer(state, action) {
  switch (action.type) {
    case CART_ACTIONS.SET_CART: {
      const cart = action.payload || {};
      const flattenedItems = cart.byStore ? cart.byStore.flatMap(store => store.items || []) : (cart.items || []);
      const total = cart.grandTotal ?? cart.subtotal ?? flattenedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const subtotal = cart.subtotal ?? flattenedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const shippingFee = cart.shippingFee ?? 0;
      const itemCount = cart.totalItems ?? flattenedItems.reduce((sum, item) => sum + item.quantity, 0);
      return {
        ...state,
        items: flattenedItems,
        byStore: cart.byStore || [],
        total,
        subtotal,
        shippingFee,
        itemCount,
        storeId: cart.byStore?.[0]?.storeId ?? cart.store ?? null,
        defaultShippingMethod: cart.byStore?.[0]?.defaultShippingMethod ?? null,
        isLoading: false,
        error: null,
      };
    }
    case CART_ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload };
    case CART_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };
    case CART_ACTIONS.CLEAR:
      return { ...initialState };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────
const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const fetchCart = useCallback(async () => {
    if (!isAuthenticated) return;
    dispatch({ type: CART_ACTIONS.SET_LOADING, payload: true });
    try {
      const data = await CartAPI.getCart();
      dispatch({ type: CART_ACTIONS.SET_CART, payload: data.cart ?? data });
    } catch (err) {
      dispatch({ type: CART_ACTIONS.SET_ERROR, payload: err.response?.data?.message ?? 'Failed to load cart' });
    }
  }, [isAuthenticated]);

  // Auto-fetch cart when user logs in
  useEffect(() => {
    if (isAuthenticated) fetchCart();
    else dispatch({ type: CART_ACTIONS.CLEAR });
  }, [isAuthenticated, fetchCart]);

  const addItem = useCallback(async (productId, quantity = 1) => {
    if (!isAuthenticated) return { success: false, error: 'Please login to add items to your cart' };
    try {
      const data = await CartAPI.addItem(productId, quantity);
      dispatch({ type: CART_ACTIONS.SET_CART, payload: data.cart ?? data });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.message ?? 'Failed to add item' };
    }
  }, [isAuthenticated]);

  const updateItem = useCallback(async (itemId, quantity) => {
    if (!isAuthenticated) return { success: false, error: 'Please login to update cart' };
    try {
      const data = await CartAPI.updateItemQuantity(itemId, quantity);
      dispatch({ type: CART_ACTIONS.SET_CART, payload: data.cart ?? data });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.message ?? 'Failed to update item' };
    }
  }, [isAuthenticated]);

  const removeItem = useCallback(async (itemId) => {
    if (!isAuthenticated) return { success: false, error: 'Please login to modify cart' };
    try {
      const data = await CartAPI.removeItem(itemId);
      dispatch({ type: CART_ACTIONS.SET_CART, payload: data.cart ?? data });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.message ?? 'Failed to remove item' };
    }
  }, [isAuthenticated]);

  const clearCart = useCallback(async () => {
    if (!isAuthenticated) return { success: false, error: 'Please login to clear cart' };
    try {
      await CartAPI.clearCart();
      dispatch({ type: CART_ACTIONS.CLEAR });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.message ?? 'Failed to clear cart' };
    }
  }, [isAuthenticated]);

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        byStore: state.byStore || [],
        total: state.total,
        subtotal: state.subtotal,
        shippingFee: state.shippingFee,
        itemCount: state.itemCount,
        storeId: state.storeId,
        defaultShippingMethod: state.defaultShippingMethod,
        isLoading: state.isLoading,
        error: state.error,
        fetchCart,
        addItem,
        updateItem,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
