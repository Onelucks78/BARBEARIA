import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../lib/useTheme.ts';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
      title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
      className={`p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition cursor-pointer ${className}`}
    >
      {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </button>
  );
};
