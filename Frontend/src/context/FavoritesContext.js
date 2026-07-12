import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useLocation } from './LocationContext';
import * as FavoritesAPI from '../api/favorites.api';

const FavoritesContext = createContext(null);

export const FavoritesProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { location } = useLocation();
  
  const [favoriteStores, setFavoriteStores] = useState([]);
  const [favoriteProducts, setFavoriteProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFavorites = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const { data } = await FavoritesAPI.getFavorites(location?.lat, location?.lng);
      setFavoriteStores(data.favoriteStores || []);
      setFavoriteProducts(data.favoriteProducts || []);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to load favorites');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, location?.lat, location?.lng]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchFavorites();
    } else {
      setFavoriteStores([]);
      setFavoriteProducts([]);
    }
  }, [isAuthenticated, fetchFavorites]);

  const toggleFavoriteStore = useCallback(async (storeId) => {
    const isFavorited = favoriteStores.some(s => s._id === storeId || s === storeId);
    try {
      if (isFavorited) {
        setFavoriteStores(prev => prev.filter(s => s._id !== storeId && s !== storeId));
        await FavoritesAPI.removeFavoriteStore(storeId);
      } else {
        setFavoriteStores(prev => [...prev, { _id: storeId }]); // Optimistic
        await FavoritesAPI.addFavoriteStore(storeId);
      }
      fetchFavorites(); // Sync with backend to get full objects
    } catch (err) {
      fetchFavorites(); // Revert on failure
      console.error('Failed to toggle store favorite', err);
    }
  }, [favoriteStores, fetchFavorites]);

  const toggleFavoriteProduct = useCallback(async (productId) => {
    const isFavorited = favoriteProducts.some(p => p._id === productId || p === productId);
    try {
      if (isFavorited) {
        setFavoriteProducts(prev => prev.filter(p => p._id !== productId && p !== productId));
        await FavoritesAPI.removeFavoriteProduct(productId);
      } else {
        setFavoriteProducts(prev => [...prev, { _id: productId }]);
        await FavoritesAPI.addFavoriteProduct(productId);
      }
      fetchFavorites();
    } catch (err) {
      fetchFavorites();
      console.error('Failed to toggle product favorite', err);
    }
  }, [favoriteProducts, fetchFavorites]);

  return (
    <FavoritesContext.Provider
      value={{
        favoriteStores,
        favoriteProducts,
        isLoading,
        error,
        fetchFavorites,
        toggleFavoriteStore,
        toggleFavoriteProduct,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
};
