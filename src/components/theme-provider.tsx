'use client';

import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type ResolvedTheme = 'light' | 'dark';
export type Theme = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (value: Theme) => void;
  isReady: boolean;
};

const STORAGE_KEY = 'pandora-box:theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyDocumentTheme = (value: ResolvedTheme, mode: Theme) => {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.dataset.theme = value;
  root.dataset.themeMode = mode;
  root.style.colorScheme = value;
};

const getInitialTheme = (): Theme => {
  if (typeof document === 'undefined') {
    return 'system';
  }

  const mode = document.documentElement.dataset.themeMode;
  
  if (mode === 'light' || mode === 'dark' || mode === 'system') {
    return mode;
  }

  return 'system';
};

const getInitialResolvedTheme = (): ResolvedTheme => {
  if (typeof document === 'undefined') {
    return 'light';
  }

  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
};

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => getInitialResolvedTheme());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeState(stored);
      }
    } catch {
      // no-op
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !isReady) {
      return;
    }

    const nextResolved = theme === 'system' ? getSystemTheme() : theme;
    setResolvedTheme(nextResolved);

    try {
      applyDocumentTheme(nextResolved, theme);
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // no-op
    }
  }, [isReady, theme]);

  useEffect(() => {
    if (typeof window === 'undefined' || theme !== 'system') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      const next = mediaQuery.matches ? 'dark' : 'light';
      setResolvedTheme(next);
      applyDocumentTheme(next, 'system');
    };

    mediaQuery.addEventListener('change', handleChange);
    handleChange();

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = useCallback((value: Theme) => {
    setThemeState(value);
  }, []);

  const contextValue = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      isReady,
    }),
    [resolvedTheme, setTheme, theme, isReady],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
