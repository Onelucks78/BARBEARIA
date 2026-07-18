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
  Plus
} from 'lucide-react';

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
    <aside className="hidden lg:flex lg:w-64 bg-[#0d0d0d] lg:border-r border-stone-850 flex-col justify-between shrink-0 select-none h-full overflow-y-auto">
      {/* Top Branding & Nav */}
      <div className="p-6 space-y-6">
        {/* Logo / Branding */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-[#c5a059] rotate-45 flex items-center justify-center font-bold text-xs text-black">
            <span className="-rotate-45">AI</span>
          </div>
          <div>
            <span className="font-serif font-normal text-sm tracking-widest uppercase block text-[#c5a059]">Escritório</span>
            <span className="text-[9px] text-[#c5a059]/70 font-mono uppercase block -mt-0.5">do Barbeiro</span>
          </div>
        </div>

        <nav className="space-y-1.5 pt-2">
          <div className="text-[9px] font-bold text-stone-500 uppercase tracking-[0.2em] px-3 mb-2 block font-mono">Menu do Negócio</div>
          
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider font-mono cursor-pointer ${
              activeTab === 'dashboard' 
                ? 'bg-[#c5a059] text-black shadow-lg font-bold' 
                : 'text-stone-400 hover:bg-stone-900 hover:text-stone-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> Balanço Financeiro
          </button>

          <button
            onClick={() => setActiveTab('agenda')}
            className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider font-mono cursor-pointer ${
              activeTab === 'agenda' 
                ? 'bg-[#c5a059] text-black shadow-lg font-bold' 
                : 'text-stone-400 hover:bg-stone-900 hover:text-stone-100'
            }`}
          >
            <Calendar className="w-4 h-4" /> Agenda & Status
          </button>

          <button
            onClick={() => setActiveTab('servicos')}
            className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider font-mono cursor-pointer ${
              activeTab === 'servicos' 
                ? 'bg-[#c5a059] text-black shadow-lg font-bold' 
                : 'text-stone-400 hover:bg-stone-900 hover:text-stone-100'
            }`}
          >
            <Scissors className="w-4 h-4" /> Serviços CRUD
          </button>

          <button
            onClick={() => setActiveTab('produtos')}
            className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider font-mono cursor-pointer ${
              activeTab === 'produtos' 
                ? 'bg-[#c5a059] text-black shadow-lg font-bold' 
                : 'text-stone-400 hover:bg-stone-900 hover:text-stone-100'
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> Produtos CRUD
          </button>

          <button
            onClick={() => setActiveTab('clientes')}
            className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider font-mono cursor-pointer ${
              activeTab === 'clientes' 
                ? 'bg-[#c5a059] text-black shadow-lg font-bold' 
                : 'text-stone-400 hover:bg-stone-900 hover:text-stone-100'
            }`}
          >
            <Users className="w-4 h-4" /> Fichas de Clientes
          </button>

          <button
            onClick={() => setActiveTab('financeiro')}
            className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider font-mono cursor-pointer ${
              activeTab === 'financeiro' 
                ? 'bg-[#c5a059] text-black shadow-lg font-bold' 
                : 'text-stone-400 hover:bg-stone-900 hover:text-stone-100'
            }`}
          >
            <CreditCard className="w-4 h-4" /> Fluxo de Caixa
          </button>

          <div className="border-t border-stone-850 my-4 pt-4">
            <div className="text-[9px] font-bold text-stone-500 uppercase tracking-[0.2em] px-3 mb-2 block font-mono">Administração Geral</div>
            <button
              onClick={() => setActiveTab('configuracoes')}
              className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider font-mono cursor-pointer ${
                activeTab === 'configuracoes' 
                  ? 'bg-[#c5a059] text-black shadow-lg font-bold' 
                  : 'text-stone-400 hover:bg-stone-900 hover:text-stone-100'
              }`}
            >
              <Sliders className="w-4 h-4" /> Escala e Bloqueios
            </button>
          </div>
        </nav>
      </div>

      {/* Bottom Sidebar Action */}
      <div className="p-6 border-t border-stone-850 bg-[#090909]/50 flex flex-col gap-3">
        {/* Plan Info Widget */}
        <div 
          onClick={() => setIsPlanModalOpen(true)}
          className="p-3 bg-black/40 border border-stone-850/60 hover:border-[#c5a059]/40 rounded-sm transition-all duration-200 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-[#c5a059] flex items-center gap-1">
              <Sparkles className="w-3 h-3 animate-pulse text-[#c5a059]" /> Plano 30 Dias
            </span>
            <span className="text-[9px] font-mono font-semibold text-stone-500 group-hover:text-stone-300 transition-colors">
              {planStats.elapsedDays}/{planStats.totalDays} dias
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-stone-900 h-1.5 rounded-full overflow-hidden mb-1.5">
            <div 
              className="bg-gradient-to-r from-[#ab843c] to-[#c5a059] h-full rounded-full transition-all duration-500"
              style={{ width: `${planStats.percent}%` }}
            />
          </div>
          
          <div className="flex justify-between items-center text-[9px] font-mono text-stone-500">
            <span>Uso: {planStats.percent}%</span>
            <span>Até: {planStats.cycleEnd.substring(0, 5)}</span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold hover:text-[#c5a059] text-stone-400 hover:bg-stone-900/60 transition duration-150 flex items-center gap-2.5 font-mono uppercase tracking-wider cursor-pointer font-bold"
        >
          <LogOut className="w-4 h-4 text-stone-500" /> Sair do Painel
        </button>
      </div>
    </aside>
  );
};

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  setIsMobileMenuOpen: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  setIsMobileMenuOpen
}) => {
  return (
    <header className="h-16 border-b border-stone-850 bg-[#0d0d0d] px-4 lg:px-8 flex items-center justify-between shrink-0 select-none">
      <div className="flex items-center gap-3">
        {/* Hamburger Button for Mobile */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="lg:hidden p-1.5 text-stone-400 hover:text-stone-100 border border-stone-850 hover:bg-stone-900 rounded-sm transition cursor-pointer"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="text-xs uppercase font-mono tracking-wider text-stone-400 flex items-center gap-1.5 lg:gap-2">
          <span className="hidden sm:inline">Admin</span>
          <span className="hidden sm:inline">/</span>
          <span className="text-[#c5a059] font-bold">
            {activeTab === 'dashboard' && 'Balanço Financeiro'}
            {activeTab === 'agenda' && 'Agenda & Status'}
            {activeTab === 'servicos' && 'Serviços CRUD'}
            {activeTab === 'produtos' && 'Produtos CRUD'}
            {activeTab === 'clientes' && 'Fichas de Clientes'}
            {activeTab === 'financeiro' && 'Fluxo de Caixa'}
            {activeTab === 'configuracoes' && 'Configurações de Escala'}
          </span>
        </h1>
      </div>
      
      <div>
        <button
          onClick={() => {
            setActiveTab('financeiro');
            setTimeout(() => {
              const selectEl = document.getElementById('finance-type-select');
              if (selectEl) selectEl.focus();
            }, 150);
          }}
          className="bg-[#c5a059] border border-[#d4af37] text-black px-4 py-2 rounded-sm text-xs font-bold transition flex items-center gap-1.5 hover:bg-[#d6b472] cursor-pointer shadow-md font-sans uppercase tracking-wide"
        >
          <Plus className="w-4 h-4" /> Registrar
        </button>
      </div>
    </header>
  );
};
