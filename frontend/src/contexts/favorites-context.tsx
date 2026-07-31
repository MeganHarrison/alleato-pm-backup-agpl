"use client";

import * as React from "react";

export interface Favorite {
  name: string;
  url: string;
  addedAt: string;
}

interface FavoritesContextValue {
  favorites: Favorite[];
  addFavorite: (name: string, url: string) => void;
  removeFavorite: (url: string) => void;
  isFavorite: (url: string) => boolean;
}

const FavoritesContext = React.createContext<FavoritesContextValue | undefined>(
  undefined,
);

const FAVORITES_STORAGE_KEY = "alleato_favorites";

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = React.useState<Favorite[]>([]);
  const [isLoaded, setIsLoaded] = React.useState(false);

  // Load favorites from localStorage on mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setFavorites(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error("Failed to load favorites from localStorage:", error);
      // Intentionally swallowed: localStorage errors are non-critical
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save favorites to localStorage whenever they change
  React.useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
      } catch (error) {
        console.error("Failed to save favorites to localStorage:", error);
        // Intentionally swallowed: localStorage errors are non-critical
      }
    }
  }, [favorites, isLoaded]);

  const addFavorite = React.useCallback((name: string, url: string) => {
    setFavorites((prev) => {
      // Don't add duplicates
      if (prev.some((fav) => fav.url === url)) {
        return prev;
      }
      return [
        ...prev,
        {
          name,
          url,
          addedAt: new Date().toISOString(),
        },
      ];
    });
  }, []);

  const removeFavorite = React.useCallback((url: string) => {
    setFavorites((prev) => prev.filter((fav) => fav.url !== url));
  }, []);

  const isFavorite = React.useCallback(
    (url: string) => {
      return favorites.some((fav) => fav.url === url);
    },
    [favorites],
  );

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        addFavorite,
        removeFavorite,
        isFavorite,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = React.useContext(FavoritesContext);

  if (!context) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }

  return context;
}
