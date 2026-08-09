import React from 'react';
import { 
  TrendingUp, 
  Calendar, 
  Scissors, 
  ShoppingBag, 
  Users, 
  CreditCard, 
  Sliders, 
  Sparkles, 
  LogOut,
  Menu,
  Plus,
  Repeat
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle.tsx';

import Logo from './Logo.tsx';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onLogout: () => void;
  setIsPlanModalOpen: (open: boolean) => void;
  planStats: {
    elapsedDays: number;
    totalDays: number;
    percent: number;
    cycleEnd: string;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onLogout,
  setIsPlanModalOpen,
  planStats
}) => {
  return (
    <aside className="hidden lg:flex lg:w-56 xl:w-64 bg-sidebar lg:border-r border-sidebar-border flex-col justify-between shrink-0 select-none h-full overflow-y-auto">
      {/* Top Branding & Nav */}
      <div className="p-4 xl:p-6 space-y-6">
        {/* Logo / Branding */}
        <div className="flex items-center justify-center py-2">
          <Logo className="h-16 xl:h-24 max-w-full w-auto object-contain shrink-0 hover:scale-105 transition-transform duration-300" />
        </div>

        <nav className="space-y-1.5 pt-2">
          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-3 mb-2 block">Menu do Negócio</div>

          <button
            onClick={() => setActiveTab('agenda')}
            className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${
              activeTab === 'agenda'
                ? 'bg-primary text-primary-foreground shadow-lg font-bold'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
            }`}
          >
            <Calendar className="w-4 h-4" /> Agenda & Status
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-primary text-primary-foreground shadow-lg font-bold'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> Balanço Financeiro
          </button>

          <button
            onClick={() => setActiveTab('equipe')}
            className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${
              activeTab === 'equipe'
                ? 'bg-primary text-primary-foreground shadow-lg font-bold'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
            }`}
          >
            <Users className="w-4 h-4" /> Equipe
          </button>

          <button
            onClick={() => setActiveTab('servicos')}
            className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${
              activeTab === 'servicos'
                ? 'bg-primary text-primary-foreground shadow-lg font-bold'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
            }`}
          >
            <Scissors className="w-4 h-4" /> Serviços CRUD
          </button>

          <button
            onClick={() => setActiveTab('produtos')}
            className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${
              activeTab === 'produtos'
                ? 'bg-primary text-primary-foreground shadow-lg font-bold'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> Produtos CRUD
          </button>

          <button
            onClick={() => setActiveTab('planos')}
            className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${
              activeTab === 'planos'
                ? 'bg-primary text-primary-foreground shadow-lg font-bold'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
            }`}
          >
            <Repeat className="w-4 h-4" /> Configurar Planos
          </button>

          <button
            onClick={() => setActiveTab('clientes')}
            className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${
              activeTab === 'clientes'
                ? 'bg-primary text-primary-foreground shadow-lg font-bold'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
            }`}
          >
            <Users className="w-4 h-4" /> Fichas de Clientes
          </button>

          <button
            onClick={() => setActiveTab('financeiro')}
            className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${
              activeTab === 'financeiro'
                ? 'bg-primary text-primary-foreground shadow-lg font-bold'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
            }`}
          >
            <CreditCard className="w-4 h-4" /> Fluxo de Caixa
          </button>

          <div className="border-t border-sidebar-border my-4 pt-4">
            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-3 mb-2 block">Administração Geral</div>
            <button
              onClick={() => setActiveTab('configuracoes')}
              className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${
                activeTab === 'configuracoes'
                  ? 'bg-primary text-primary-foreground shadow-lg font-bold'
                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
              }`}
            >
              <Sliders className="w-4 h-4" /> Escala e Bloqueios
            </button>
          </div>
        </nav>
      </div>

      {/* Bottom Sidebar Action */}
      <div className="p-4 xl:p-6 border-t border-sidebar-border flex flex-col gap-3">
        {/* Plan Info Widget */}
        <div
          onClick={() => setIsPlanModalOpen(true)}
          className="p-3 bg-card border border-sidebar-border/60 hover:border-primary/40 rounded-sm transition-all duration-200 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] uppercase tracking-wider font-bold text-primary flex items-center gap-1">
              <Sparkles className="w-3 h-3 animate-pulse text-primary" /> Plano 30 Dias
            </span>
            <span className="text-[9px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
              {planStats.elapsedDays}/{planStats.totalDays} dias
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden mb-1.5">
            <div
              className="bg-gradient-to-r from-primary/60 to-primary h-full rounded-full transition-all duration-500"
              style={{ width: `${planStats.percent}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[9px] text-muted-foreground">
            <span>Uso: {planStats.percent}%</span>
            <span>Até: {planStats.cycleEnd.substring(0, 5)}</span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold hover:text-primary text-muted-foreground hover:bg-sidebar-accent/60 transition duration-150 flex items-center gap-2.5 uppercase tracking-wider cursor-pointer font-bold"
        >
          <LogOut className="w-4 h-4 text-muted-foreground" /> Sair do Painel
        </button>
      </div>
    </aside>
  );
};

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  setIsMobileMenuOpen: (open: boolean) => void;
  onOpenFinanceModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  setIsMobileMenuOpen,
  onOpenFinanceModal
}) => {
  return (
    <header className="h-16 border-b border-sidebar-border bg-sidebar px-4 lg:px-8 flex items-center justify-between shrink-0 select-none">
      <div className="flex items-center gap-3">
        {/* Hamburger Button for Mobile */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="lg:hidden p-1.5 text-muted-foreground hover:text-foreground border border-sidebar-border hover:bg-sidebar-accent rounded-sm transition cursor-pointer"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 lg:gap-2">
          <span className="hidden sm:inline">Admin</span>
          <span className="hidden sm:inline">/</span>
          <span className="text-primary font-bold">
            {activeTab === 'dashboard' && 'Balanço Financeiro'}
            {activeTab === 'agenda' && 'Agenda & Status'}
            {activeTab === 'equipe' && 'Equipe'}
            {activeTab === 'servicos' && 'Serviços CRUD'}
            {activeTab === 'produtos' && 'Produtos CRUD'}
            {activeTab === 'planos' && 'Configurar Planos'}
            {activeTab === 'clientes' && 'Fichas de Clientes'}
            {activeTab === 'financeiro' && 'Fluxo de Caixa'}
            {activeTab === 'configuracoes' && 'Configurações de Escala'}
          </span>
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => {
            if (onOpenFinanceModal) {
              onOpenFinanceModal();
            } else {
              setActiveTab('financeiro');
            }
          }}
          className="bg-primary border border-primary text-primary-foreground px-4 py-2 rounded-sm text-xs font-bold transition flex items-center gap-1.5 hover:bg-primary/90 cursor-pointer shadow-md font-sans uppercase tracking-wide"
        >
          <Plus className="w-4 h-4" /> Registrar
        </button>
      </div>
    </header>
  );
};
