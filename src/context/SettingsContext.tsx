import * as React from 'react';

interface SettingsContextType {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  columnsCount: number;
  setColumnsCount: (count: number) => void;
  hideHostnames: boolean;
  setHideHostnames: (hide: boolean) => void;
  enableFavicons: boolean;
  setEnableFavicons: (enable: boolean) => void;
}

const SettingsContext = React.createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // Theme state synced with documentElement class and LocalStorage
  const [theme, setThemeState] = React.useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem('linkhub_theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return document.documentElement.classList.contains('light') ? 'light' : 'dark';
  });

  // Columns Count state (2, 3, 4, 5)
  const [columnsCount, setColumnsCountState] = React.useState<number>(() => {
    const stored = localStorage.getItem('linkhub_columns');
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (parsed >= 2 && parsed <= 5) return parsed;
    }
    return 3; // Default columns
  });

  // Hide Hostnames state
  const [hideHostnames, setHideHostnamesState] = React.useState<boolean>(() => {
    const stored = localStorage.getItem('linkhub_hide_hostnames');
    return stored === 'true'; // Default is false
  });

  // Enable Favicons state
  const [enableFavicons, setEnableFaviconsState] = React.useState<boolean>(() => {
    const stored = localStorage.getItem('linkhub_enable_favicons');
    return stored !== 'false'; // Default is true
  });

  // Apply theme class to document element on changes
  React.useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('linkhub_theme', theme);
  }, [theme]);

  const setTheme = (t: 'dark' | 'light') => setThemeState(t);
  
  const setColumnsCount = (count: number) => {
    if (count >= 2 && count <= 5) {
      setColumnsCountState(count);
      localStorage.setItem('linkhub_columns', count.toString());
    }
  };

  const setHideHostnames = (hide: boolean) => {
    setHideHostnamesState(hide);
    localStorage.setItem('linkhub_hide_hostnames', hide.toString());
  };

  const setEnableFavicons = (enable: boolean) => {
    setEnableFaviconsState(enable);
    localStorage.setItem('linkhub_enable_favicons', enable.toString());
  };

  return (
    <SettingsContext.Provider
      value={{
        theme,
        setTheme,
        columnsCount,
        setColumnsCount,
        hideHostnames,
        setHideHostnames,
        enableFavicons,
        setEnableFavicons
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = React.useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
