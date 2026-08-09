import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Scissors,
  ShoppingBag,
  Users,
  CreditCard,
  Sliders,
  Plus,
  Trash2,
  AlertTriangle,
  Clock,
  Save,
  Settings,
  CalendarX,
  FileSpreadsheet,
  LogOut,
  Sparkles,
  BookOpen,
  Edit,
  Menu,
  X,
  Search,
  Minus,
  CheckCircle2,
  Upload,
  Loader2,
  XCircle
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { Sidebar, Header } from './Layout.tsx';
import Logo from './Logo.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Textarea } from '@/components/ui/textarea.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import {
  Servico,
  Produto,
  Cliente,
  Agendamento,
  Expediente,
  Bloqueio,
  LancamentoFinanceiro,
  DashboardStats,
  CategoriaFinanceira,
  ClienteSubscription,
  Profissional
} from '../types.ts';
import type { Session } from '@supabase/supabase-js';
import { authedFetch, supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { emailEDeTelefone } from '../../lib/telefone';
import EquipeTab from './admin/EquipeTab.tsx';
import FiltroBarbeiro from './admin/FiltroBarbeiro.tsx';
import ManualBookingModal from './admin/ManualBookingModal.tsx';
import AgendaSemanal from './admin/AgendaSemanal.tsx';
import AgendaDetalheModal from './admin/AgendaDetalheModal.tsx';
import { resizeImageToDataUrl, uploadImagem } from '../lib/imagem.ts';

interface AdminLayoutProps {
  session: Session;
  onLogout: () => void;
}

// Planos de assinatura recorrente — mesmas 3 chaves canônicas gravadas em subscription.plan
// pelo checkout do cliente (UserLayout). Apenas informativo aqui: a edição dos planos
// acontece no fluxo de checkout, não neste painel.
const PLAN_TIERS: {
  key: 'essential' | 'premium' | 'exclusive';
  label: string;
  price: number;
  features: string[];
  textClass: string;
  borderClass: string;
  badgeClass: string;
}[] = [
  {
    key: 'essential',
    label: 'Essential',
    price: 109.99,
    features: ['Corte ilimitado'],
    textClass: 'text-muted-foreground',
    borderClass: 'border-border',
    badgeClass: 'bg-card text-muted-foreground border border-border'
  },
  {
    key: 'premium',
    label: 'Premium',
    price: 149.99,
    features: ['Corte ilimitado', 'Barba ilimitada'],
    textClass: 'text-primary',
    borderClass: 'border-primary/30',
    badgeClass: 'bg-primary/10 text-primary border border-primary/25'
  },
  {
    key: 'exclusive',
    label: 'Exclusive',
    price: 199.99,
    features: ['Corte ilimitado', 'Barba ilimitada', 'Sobrancelha ilimitada', 'Penteado ilimitado'],
    textClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-amber-300 dark:border-amber-900/50',
    badgeClass: 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40'
  }
];

// Rótulo amigável para uma chave de plano crua; plano legado/desconhecido cai de volta na própria chave.
const planLabel = (plan: string): string => PLAN_TIERS.find(t => t.key === plan.toLowerCase())?.label ?? plan;

// Classes do badge de plano; plano legado/desconhecido usa um estilo neutro.
const planBadgeClass = (plan: string): string =>
  PLAN_TIERS.find(t => t.key === plan.toLowerCase())?.badgeClass ?? 'bg-card text-muted-foreground border border-border';

function getLocalDateString(d = new Date()): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

export default function AdminLayout({ session, onLogout }: AdminLayoutProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'agenda' | 'equipe' | 'servicos' | 'produtos' | 'planos' | 'clientes' | 'financeiro' | 'configuracoes'>('agenda');
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  // '' = todos os barbeiros. Vale para agenda, financeiro e dashboard.
  const [filtroProfissional, setFiltroProfissional] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Backend States
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [financeiro, setFinanceiro] = useState<LancamentoFinanceiro[]>([]);
  const [configuracoes, setConfiguracoes] = useState<{ expedientes: Expediente[]; bloqueios: Bloqueio[] } | null>(null);

  // Filter States
  const [dashboardPeriod, setDashboardPeriod] = useState<'all' | '30' | '7' | 'today'>('today');
  const [dashboardCurrentPage, setDashboardCurrentPage] = useState(1);
  const dashboardLogsPerPage = 40;
  const [dashboardCardFilter, setDashboardCardFilter] = useState<'cortes' | 'produtos' | 'despesas' | 'lucro' | null>(null);

  // Reset page on filter changes
  useEffect(() => {
    setDashboardCurrentPage(1);
  }, [dashboardCardFilter, dashboardPeriod]);
  const [agendaDateFilter, setAgendaDateFilter] = useState<string>('');
  const [agendaFilterMode, setAgendaFilterMode] = useState<'upcoming' | 'day'>('upcoming');
  const [clientSearchQuery, setClientSearchQuery] = useState('');

  // UI action states (Modals or quick add forms toggles)
  const [isManualBookingModalOpen, setIsManualBookingModalOpen] = useState(false);
  const [slotInicial, setSlotInicial] = useState<{ data: string; horario: string } | undefined>(undefined);
  const [agendamentoDetalhe, setAgendamentoDetalhe] = useState<Agendamento | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form creation States
  const [newService, setNewService] = useState({ nome: '', descricao: '', preco: '', duracao_minutos: '45', imagem_url: '' });
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [uploadingServiceImage, setUploadingServiceImage] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);

  const [newProduct, setNewProduct] = useState({ nome: '', descricao: '', preco: '', estoque: '10', imagem_url: '' });
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [uploadingProductImage, setUploadingProductImage] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);

  const [newClient, setNewClient] = useState({ nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '', senha: '' });
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [linkPagamento, setLinkPagamento] = useState<{ clienteId: string; url: string } | null>(null);
  const [gerandoLink, setGerandoLink] = useState(false);

  const [newLaunch, setNewLaunch] = useState({ tipo: 'entrada', descricao: '', valor: '', categoria: '', forma_pagamento: 'pix', data: '', produto_id: '', profissional_id: '' });
  const [editingFinanceId, setEditingFinanceId] = useState<string | null>(null);
  const [showFinanceForm, setShowFinanceForm] = useState(false);
  const [editFinanceForm, setEditFinanceForm] = useState({ tipo: 'entrada', descricao: '', valor: '', categoria: 'Serviços', forma_pagamento: 'pix', data: '' });
  const [newBlock, setNewBlock] = useState({ data: '', hora_inicio: '', hora_fim: '', motivo: '' });

  // Custom Categories States
  const [categoriasFinanceiras, setCategoriasFinanceiras] = useState<CategoriaFinanceira[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  // Helper to get plan progress based on closing on the 5th day of each month
  const getPlanProgress = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    let cycleStart = new Date(year, month, 5);
    let cycleEnd = new Date(year, month + 1, 5);
    
    if (now < cycleStart) {
      cycleStart = new Date(year, month - 1, 5);
      cycleEnd = new Date(year, month, 5);
    }
    
    const totalMs = cycleEnd.getTime() - cycleStart.getTime();
    const elapsedMs = now.getTime() - cycleStart.getTime();
    
    const totalDays = Math.round(totalMs / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.max(0, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));
    const remainingDays = Math.max(0, totalDays - elapsedDays);
    const percent = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
    
    const formatDate = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };
    
    return {
      percent,
      elapsedDays,
      remainingDays,
      totalDays,
      cycleStart: formatDate(cycleStart),
      cycleEnd: formatDate(cycleEnd),
    };
  };

  const planStats = getPlanProgress();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'entrada' | 'saida'>('entrada');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryType, setEditingCategoryType] = useState<'entrada' | 'saida'>('entrada');

  const [defaultIntervalStart, setDefaultIntervalStart] = useState('12:00');
  const [defaultIntervalEnd, setDefaultIntervalEnd] = useState('13:00');
  const [batchStart, setBatchStart] = useState('08:00');
  const [batchEnd, setBatchEnd] = useState('20:00');
  const [selectedConfigProfissionalId, setSelectedConfigProfissionalId] = useState<string>('all');

  // Filters & Pagination for Fluxo de Caixa listing
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterFinanceStartDate, setFilterFinanceStartDate] = useState<string>('');
  const [filterFinanceEndDate, setFilterFinanceEndDate] = useState<string>('');
  const [financeCurrentPage, setFinanceCurrentPage] = useState(1);
  const logsPerPage = 40;

  // Initialize dates
  useEffect(() => {
    const todayStr = getLocalDateString();
    setAgendaDateFilter(todayStr);
    setNewLaunch(prev => ({ ...prev, data: todayStr }));
    setNewBlock(prev => ({ ...prev, data: todayStr }));
  }, []);

  // Sync Load Data Helpers
  // authedFetch injeta automaticamente o header Authorization com JWT do Supabase.

  const fetchDashboard = () => {
    // Helper: returns YYYY-MM-DD in local timezone (avoids UTC shift at night)
    const localDate = (d = new Date()) => {
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    };

    let url = '/api/admin/dashboard';
    if (dashboardPeriod === 'today') {
      const todayStr = localDate();
      url += `?start_date=${todayStr}&end_date=${todayStr}T23:59:59.999Z&is_today=true`;
    } else if (dashboardPeriod === '30') {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      url += `?start_date=${localDate(start)}&end_date=${localDate()}T23:59:59.999Z`;
    } else if (dashboardPeriod === '7') {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      url += `?start_date=${localDate(start)}&end_date=${localDate()}T23:59:59.999Z`;
    }

    if (filtroProfissional) {
      url += (url.includes('?') ? '&' : '?') + `profissional_id=${filtroProfissional}`;
    }

    authedFetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => setDashboardStats(data))
      .catch(err => console.error('Dashboard:', err));
  };


  const fetchAgendamentos = () => {
    const url = filtroProfissional
      ? `/api/admin/agendamentos?profissional_id=${filtroProfissional}`
      : '/api/admin/agendamentos';
    authedFetch(url)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => setAgendamentos(data))
      .catch(err => console.error('Agendamentos:', err));
  };

  const fetchProfissionais = () => {
    authedFetch('/api/admin/profissionais')
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => setProfissionais(data))
      .catch(err => console.error('Profissionais:', err));
  };

  const fetchServicos = () => {
    authedFetch('/api/admin/servicos')
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => setServicos(data))
      .catch(err => console.error('Serviços:', err));
  };

  const fetchProdutos = () => {
    authedFetch('/api/admin/produtos')
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => setProdutos(data))
      .catch(err => console.error('Produtos:', err));
  };

  const fetchClientes = () => {
    authedFetch('/api/admin/clientes')
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => setClientes(data))
      .catch(err => console.error('Clientes:', err));
  };

  const fetchFinanceiro = () => {
    const url = filtroProfissional
      ? `/api/admin/financeiro?profissional_id=${filtroProfissional}`
      : '/api/admin/financeiro';
    authedFetch(url)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => setFinanceiro(data))
      .catch(err => console.error('Financeiro:', err));
  };

  const fetchCategorias = () => {
    authedFetch('/api/admin/categorias-financeiras')
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => setCategoriasFinanceiras(data))
      .catch(err => console.error('Categorias:', err));
  };

  const fetchConfiguracoes = () => {
    authedFetch('/api/admin/configuracoes')
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => setConfiguracoes(data))
      .catch(err => console.error('Configurações:', err));
  };

  // Run on load or on tab change
  useEffect(() => {
    setErrorMsg('');
    setSuccessMsg('');
    setDashboardCardFilter(null);
    
    if (activeTab === 'dashboard') {
      fetchDashboard();
    } else if (activeTab === 'agenda') {
      fetchAgendamentos();
      fetchClientes();
      // O modal de agendamento manual precisa da lista de serviços. Sem isso ela
      // só era carregada se o admin passasse antes pela aba "Serviços".
      fetchServicos();
    } else if (activeTab === 'equipe') {
      fetchProfissionais();
    } else if (activeTab === 'servicos') {
      fetchServicos();
    } else if (activeTab === 'produtos') {
      fetchProdutos();
    } else if (activeTab === 'planos') {
      fetchClientes();
    } else if (activeTab === 'clientes') {
      fetchClientes();
    } else if (activeTab === 'financeiro') {
      fetchFinanceiro();
      fetchCategorias();
      fetchProdutos(); // to link item sale
    } else if (activeTab === 'configuracoes') {
      fetchConfiguracoes();
    }
  }, [activeTab, dashboardPeriod, filtroProfissional]);

  useEffect(() => {
    fetchProfissionais();
  }, []);

  // ---------- REAL-TIME & AUTO-POLLING AGENDAMENTOS ----------
  // 1. Supabase Realtime Channel: escuta alterações na tabela agendamentos em tempo real
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('realtime-admin-agendamentos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agendamentos' },
        () => {
          fetchAgendamentos();
          if (activeTab === 'dashboard') fetchDashboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, filtroProfissional, dashboardPeriod]);

  // 2. Intervalo de atualização (5s) + ouvinte de eventos de novos agendamentos
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'agenda' || activeTab === 'dashboard') {
        fetchAgendamentos();
        if (activeTab === 'dashboard') fetchDashboard();
      }
    }, 5000);

    const handleBookingCreated = () => {
      fetchAgendamentos();
      fetchDashboard();
    };
    window.addEventListener('agendamento-criado', handleBookingCreated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('agendamento-criado', handleBookingCreated);
    };
  }, [activeTab, filtroProfissional, dashboardPeriod]);

  // Set default category when type transitions
  useEffect(() => {
    const list = categoriasFinanceiras.filter(c => c.tipo === newLaunch.tipo);
    if (list.length > 0) {
      setNewLaunch(prev => ({ ...prev, categoria: list[0].nome }));
    } else {
      setNewLaunch(prev => ({ ...prev, categoria: '' }));
    }
  }, [newLaunch.tipo, categoriasFinanceiras]);

  // Toast auto-dismissal
  useEffect(() => {
    if (successMsg || errorMsg) {
      const t = setTimeout(() => {
        setSuccessMsg('');
        setErrorMsg('');
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [successMsg, errorMsg]);

  // Operations: Update Appointment Status
  const handleUpdateBookingStatus = async (bookingId: string, status: any) => {
    try {
      const res = await authedFetch(`/api/admin/agendamentos/${encodeURIComponent(bookingId)}`, {
        method: 'PATCH',

        body: { status }
      });
      if (!res.ok) throw new Error('Falha ao atualizar estado.');
      setSuccessMsg('O status do agendamento foi modificado com sucesso.');
      fetchAgendamentos();
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  // Link pre-registered client
  const handleLinkClientToBooking = async (bookingId: string, clienteId: string) => {
    if (!clienteId) return;
    try {
      const chosenClient = clientes.find(c => c.id === clienteId);
      const res = await authedFetch(`/api/admin/agendamentos/${encodeURIComponent(bookingId)}`, {
        method: 'PATCH',
        body: {
          cliente_id: clienteId,
          nome_cliente: chosenClient?.nome
        }
      });
      if (!res.ok) throw new Error('Falha ao vincular cliente.');
      setSuccessMsg('Cliente vinculado de forma definitiva.');
      fetchAgendamentos();
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  // Image upload helpers (Serviços/Produtos): redimensiona no canvas do navegador antes de subir pro Supabase Storage
  const handleServiceImageSelect = async (file: File | undefined) => {
    if (!file) return;
    setUploadingServiceImage(true);
    setErrorMsg('');
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const url = await uploadImagem(dataUrl, 'servicos');
      setNewService(prev => ({ ...prev, imagem_url: url }));
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setUploadingServiceImage(false);
    }
  };

  const handleProductImageSelect = async (file: File | undefined) => {
    if (!file) return;
    setUploadingProductImage(true);
    setErrorMsg('');
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const url = await uploadImagem(dataUrl, 'produtos');
      setNewProduct(prev => ({ ...prev, imagem_url: url }));
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setUploadingProductImage(false);
    }
  };

  // CRUD Actions: SERVICES
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const isEditing = !!editingServiceId;
      const url = isEditing ? `/api/admin/servicos/${editingServiceId}` : '/api/admin/servicos';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await authedFetch(url, {
        method,
        body: {
          nome: newService.nome,
          descricao: newService.descricao,
          preco: Number(newService.preco),
          duracao_minutos: Number(newService.duracao_minutos),
          ...(newService.imagem_url ? { imagem_url: newService.imagem_url } : {})
        }
      });

      if (!res.ok) throw new Error('Erro ao salvar serviço.');
      setSuccessMsg(isEditing ? 'Serviço atualizado com sucesso.' : 'Novo serviço adicionado.');
      setNewService({ nome: '', descricao: '', preco: '', duracao_minutos: '45', imagem_url: '' });
      setEditingServiceId(null);
      setShowServiceForm(false);
      fetchServicos();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditServiceSelect = (s: Servico) => {
    setEditingServiceId(s.id);
    setNewService({
      nome: s.nome,
      descricao: s.descricao,
      preco: String(s.preco),
      duracao_minutos: String(s.duracao_minutos),
      imagem_url: s.imagem_url
    });
    setShowServiceForm(true);
    setTimeout(() => document.getElementById('service-form-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  // Flip service active flag (soft delete)
  const handleToggleServiceActive = async (s: Servico) => {
    try {
      const res = await authedFetch(`/api/admin/servicos/${s.id}`, {
        method: 'PATCH',

        body: { ativo: !s.ativo }
      });
      if (!res.ok) throw new Error('Erro ao desativar.');
      fetchServicos();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // CRUD Actions: PRODUCTS
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const isEditing = !!editingProductId;
      const url = isEditing ? `/api/admin/produtos/${editingProductId}` : '/api/admin/produtos';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await authedFetch(url, {
        method,
        body: {
          nome: newProduct.nome,
          descricao: newProduct.descricao,
          preco: Number(newProduct.preco),
          estoque: Number(newProduct.estoque),
          ...(newProduct.imagem_url ? { imagem_url: newProduct.imagem_url } : {})
        }
      });

      if (!res.ok) throw new Error('Erro ao criar ou atualizar produto.');
      setSuccessMsg(isEditing ? 'Preços e estoques atualizados com sucesso.' : 'Novo cosmético cadastrado.');
      setNewProduct({ nome: '', descricao: '', preco: '', estoque: '10', imagem_url: '' });
      setEditingProductId(null);
      setShowProductForm(false);
      fetchProdutos();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditProductSelect = (p: Produto) => {
    setEditingProductId(p.id);
    setNewProduct({
      nome: p.nome,
      descricao: p.descricao,
      preco: String(p.preco),
      estoque: String(p.estoque),
      imagem_url: p.imagem_url
    });
    setShowProductForm(true);
    setTimeout(() => document.getElementById('product-form-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const handleToggleProductActive = async (p: Produto) => {
    try {
      const res = await authedFetch(`/api/admin/produtos/${p.id}`, {
        method: 'PATCH',

        body: { ativo: !p.ativo }
      });
      if (!res.ok) throw new Error('Erro técnico ao arquivar produto.');
      fetchProdutos();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleAdjustStock = async (p: Produto, delta: number) => {
    const newStock = Math.max(0, p.estoque + delta);
    try {
      const res = await authedFetch(`/api/admin/produtos/${p.id}`, {
        method: 'PATCH',
        body: { estoque: newStock }
      });
      if (!res.ok) throw new Error('Erro ao ajustar estoque.');
      fetchProdutos();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };


  // CRUD Actions: CLIENTES
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const isEditing = !!editingClientId;
      const url = isEditing ? `/api/admin/clientes/${editingClientId}` : '/api/admin/clientes';
      const method = isEditing ? 'PATCH' : 'POST';

      // A senha só existe na criação: para editar, o painel usa a rota de redefinir senha.
      const { senha, ...semSenha } = newClient;
      const payload = (!isEditing && senha) ? newClient : semSenha;

      const res = await authedFetch(url, {
        method,
        body: payload
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao cuidar do cadastro de cliente.');
      }
      setSuccessMsg(isEditing ? 'Ficha técnica do cliente atualizada.' : 'Cliente fidelizado com sucesso.');
      setNewClient({ nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '', senha: '' });
      setEditingClientId(null);
      setShowClientForm(false);
      fetchClientes();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClientSelect = (c: Cliente) => {
    setEditingClientId(c.id);
    setNewClient({
      nome: c.nome,
      telefone: c.telefone,
      email: c.email || '',
      data_nascimento: c.data_nascimento || '',
      observacoes: c.observacoes || '',
      senha: ''
    });
    setShowClientForm(true);
  };

  const handleToggleClientActive = async (c: Cliente) => {
    try {
      const res = await authedFetch(`/api/admin/clientes/${c.id}`, {
        method: 'PATCH',

        body: { ativo: false } // soft archive
      });
      if (!res.ok) throw new Error('Não foi possível arquivar a ficha do cliente.');
      setSuccessMsg('Ficha arquivada com sucesso.');
      fetchClientes();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleGerarLinkPagamento = async (c: Cliente, planId: string) => {
    setGerandoLink(true);
    setLinkPagamento(null);
    try {
      const res = await authedFetch(`/api/admin/clientes/${c.id}/link-pagamento`, {
        method: 'POST',
        body: { planId }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível gerar o link.');
      setLinkPagamento({ clienteId: c.id, url: data.url });
      setSuccessMsg('Link de pagamento pronto. Copie ou mande no WhatsApp.');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setGerandoLink(false);
    }
  };

  const handleRedefinirSenhaCliente = async (c: Cliente) => {
    const nova = window.prompt(`Nova senha para ${c.nome} (mínimo 6 caracteres):`);
    if (!nova) return;
    if (nova.length < 6) {
      setErrorMsg('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    try {
      const res = await authedFetch(`/api/admin/clientes/${c.id}/redefinir-senha`, {
        method: 'POST',
        body: { senha: nova }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível redefinir a senha.');
      setSuccessMsg(`Senha de ${c.nome} atualizada. Avise o cliente.`);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleDeleteClient = async (c: Cliente) => {
    if (!window.confirm(`Tem certeza que deseja deletar o cliente "${c.nome}" permanentemente?`)) return;
    try {
      const res = await authedFetch(`/api/admin/clientes/${c.id}`, {
        method: 'DELETE',

      });
      if (!res.ok) throw new Error('Não foi possível deletar o cliente.');
      setSuccessMsg('Cliente deletado permanentemente.');
      fetchClientes();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };


  // Financial additions
  const handleSaveFinanceLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fallbackCategoria = categoriasFinanceiras.find(c => c.tipo === newLaunch.tipo)?.nome || 'Geral';
      const numericValor = Number(String(newLaunch.valor).replace(',', '.'));
      const launchPayload: any = {
        ...newLaunch,
        descricao: newLaunch.descricao.trim() || (newLaunch.tipo === 'entrada' ? 'entrada' : 'saída'),
        valor: isNaN(numericValor) ? 0 : numericValor,
        categoria: newLaunch.categoria || fallbackCategoria
      };
      if (!launchPayload.produto_id) {
        delete launchPayload.produto_id;
      }
      // '' vira null: lançamento da casa. Produto é sempre da casa.
      launchPayload.profissional_id = launchPayload.produto_id
        ? null
        : (launchPayload.profissional_id || null);
      const res = await authedFetch('/api/admin/financeiro', {
        method: 'POST',
        body: launchPayload
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao registrar fluxo financeiro.');
      }

      setSuccessMsg('Lançamento registrado de forma definitiva no livro-caixa.');
      const firstEntradaCat = categoriasFinanceiras.find(c => c.tipo === 'entrada')?.nome || '';
      setNewLaunch({
        tipo: 'entrada',
        descricao: '',
        valor: '',
        categoria: firstEntradaCat,
        forma_pagamento: 'pix',
        data: new Date().toISOString().split('T')[0],
        produto_id: '',
        profissional_id: ''
      });
      setShowFinanceForm(false);
      fetchFinanceiro();
      fetchDashboard();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFinance = async (id: string) => {
    if (!window.confirm('Tem certeza de que deseja excluir este lançamento do faturamento ativo? Ele continuará registrado como histórico no fluxo de caixa.')) return;
    try {
      const res = await authedFetch(`/api/admin/financeiro/${id}`, {
        method: 'DELETE',

      });
      if (!res.ok) throw new Error('Falha ao excluir lançamento.');
      setSuccessMsg('Lançamento removido e armazenado como histórico no fluxo de caixa.');
      fetchFinanceiro();
      fetchDashboard();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleEditFinanceClick = (f: LancamentoFinanceiro) => {
    setEditingFinanceId(f.id);
    setEditFinanceForm({
      tipo: f.tipo,
      descricao: f.descricao,
      valor: String(f.valor),
      categoria: f.categoria,
      forma_pagamento: f.forma_pagamento as any,
      data: f.data
    });
  };

  const handleSaveEditFinance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await authedFetch(`/api/admin/financeiro/${editingFinanceId}`, {
        method: 'PATCH',

        body: {
          tipo: editFinanceForm.tipo,
          descricao: editFinanceForm.descricao.trim() || (editFinanceForm.tipo === 'entrada' ? 'entrada' : 'saída'),
          valor: Number(editFinanceForm.valor),
          categoria: editFinanceForm.categoria,
          forma_pagamento: editFinanceForm.forma_pagamento,
          data: editFinanceForm.data
        }
      });
      if (!res.ok) throw new Error('Falha ao salvar as alterações do lançamento.');
      setSuccessMsg('Lançamento financeiro editado com sucesso.');
      setEditingFinanceId(null);
      fetchFinanceiro();
      fetchDashboard();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Categories Operations
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setSubmitting(true);
    try {
      const res = await authedFetch('/api/admin/categorias-financeiras', {
        method: 'POST',

        body: { nome: newCategoryName.trim(), tipo: newCategoryType }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao criar categoria.');
      }
      setSuccessMsg('Categoria criada com sucesso!');
      setNewCategoryName('');
      fetchCategorias();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategoryName.trim() || !editingCategoryId) return;
    setSubmitting(true);
    try {
      const res = await authedFetch(`/api/admin/categorias-financeiras/${editingCategoryId}`, {
        method: 'PATCH',

        body: { nome: editingCategoryName.trim(), tipo: editingCategoryType }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao atualizar categoria.');
      }
      setSuccessMsg('Categoria atualizada com sucesso!');
      setEditingCategoryId(null);
      setEditingCategoryName('');
      fetchCategorias();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar categoria');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Deseja realmente excluir esta categoria? Os lançamentos existentes que a utilizam não serão alterados, mas ela não estará disponível para novos lançamentos.')) return;
    try {
      const res = await authedFetch(`/api/admin/categorias-financeiras/${id}`, {
        method: 'DELETE',

      });
      if (!res.ok) throw new Error('Falha ao excluir categoria.');
      setSuccessMsg('Categoria excluída com sucesso.');
      fetchCategorias();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };


  // Configuration actions: Expedientes & Bloqueios
  const handleUpdateExpediente = async (id: string, fields: any) => {
    try {
      const res = await authedFetch(`/api/admin/expedientes/${id}`, {
        method: 'PATCH',

        body: fields
      });
      if (!res.ok) throw new Error('Não foi possível atualizar turno.');
      setSuccessMsg('Escala de expediente atualizada.');
      fetchConfiguracoes();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleApplyDefaultInterval = async () => {
    if (!batchStart || !batchEnd) {
      setErrorMsg('Por favor, informe a hora de abertura e de fechamento.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const bodyPayload: any = {
        hora_inicio: batchStart,
        hora_fim: batchEnd,
        intervalo_inicio: defaultIntervalStart || null,
        intervalo_fim: defaultIntervalEnd || null
      };
      if (selectedConfigProfissionalId !== 'all') {
        bodyPayload.profissional_id = selectedConfigProfissionalId;
      }
      const queryParam = selectedConfigProfissionalId !== 'all' ? `?profissional_id=${encodeURIComponent(selectedConfigProfissionalId)}` : '';
      const res = await authedFetch(`/api/admin/expedientes/intervalo-padrao${queryParam}`, {
        method: 'POST',
        body: bodyPayload
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Não foi possível atualizar a escala.');
      }
      setSuccessMsg('Escala de expediente atualizada para todos os dias com sucesso!');
      fetchConfiguracoes();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await authedFetch('/api/admin/bloqueios', {
        method: 'POST',

        body: {
          data: newBlock.data,
          hora_inicio: newBlock.hora_inicio || null,
          hora_fim: newBlock.hora_fim || null,
          motivo: newBlock.motivo
        }
      });

      if (!res.ok) throw new Error('Erro ao registrar bloqueio de horário.');
      setSuccessMsg('Bloqueio de horários inserido na agenda.');
      setNewBlock({
        data: new Date().toISOString().split('T')[0],
        hora_inicio: '',
        hora_fim: '',
        motivo: ''
      });
      fetchConfiguracoes();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBlock = async (id: string) => {
    try {
      const res = await authedFetch(`/api/admin/bloqueios/${id}`, {
        method: 'DELETE',

      });
      if (!res.ok) throw new Error('Erro ao demover bloqueio.');
      setSuccessMsg('Grade de bloqueios liberada.');
      fetchConfiguracoes();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };


  // Text Helpers
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const getDayName = (dayIdx: number) => {
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return days[dayIdx];
  };

  const getWhatsAppLink = (telefone: string) => {
    const digits = (telefone || '').replace(/\D/g, '');
    const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
    return `https://wa.me/${withCountry}`;
  };

  // Lê a assinatura empacotada como JSON dentro de Cliente.observacoes (mesmo formato usado no checkout do cliente)
  const parseSubscription = (cliente: Cliente): ClienteSubscription | null => {
    if (!cliente.observacoes) return null;
    try {
      if (cliente.observacoes.trim().startsWith('{')) {
        const parsed = JSON.parse(cliente.observacoes);
        if (parsed.subscription) return parsed.subscription as ClienteSubscription;
      }
    } catch {}
    return null;
  };

  // Clientes com assinatura do Plano VIP, classificados por renovação em dia ou vencida
  const assinantesVIP = clientes
    .map(c => ({ cliente: c, subscription: parseSubscription(c) }))
    .filter((x): x is { cliente: Cliente; subscription: ClienteSubscription } => x.subscription !== null)
    .map(x => ({
      ...x,
      renovado: new Date(x.subscription.renews_at) >= new Date()
    }));

  // Assinantes agrupados por tier (Essential/Premium/Exclusive) para o resumo da aba Planos
  const assinantesPorPlano = PLAN_TIERS.map(tier => ({
    tier,
    subs: assinantesVIP.filter(a => (a.subscription.plan || '').toLowerCase() === tier.key)
  }));
  // Assinaturas com um valor de plano que não bate com nenhuma das 3 chaves atuais (ex.: dado legado 'VIP')
  const assinantesOutrosPlanos = assinantesVIP.filter(
    a => !PLAN_TIERS.some(t => t.key === (a.subscription.plan || '').toLowerCase())
  );

  // Filtered list of agenda
  const filteredAgendamentos = [...agendamentos]
    .filter(a => {
      const todayStr = getLocalDateString();
      const appointmentDateStr = a.inicio_em.split('T')[0];
      
      if (agendaFilterMode === 'upcoming') {
        // Show today (all day) and all upcoming future bookings
        return appointmentDateStr >= todayStr;
      } else {
        if (!agendaDateFilter) return true;
        return appointmentDateStr === agendaDateFilter;
      }
    })
    .sort((a, b) => {
      return new Date(a.inicio_em).getTime() - new Date(b.inicio_em).getTime();
    });

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col lg:flex-row font-sans">
      {/* Persistent Toast alerts */}
      {(successMsg || errorMsg) && (
        <div className="fixed top-6 right-6 z-50 max-w-sm space-y-2 animate-fade-in">
          {successMsg && (
            <div className="glass-panel-nested border-l-4 border-primary border-t border-b border-r border-card text-foreground p-4 rounded-sm shadow-2xl text-xs font-semibold">
              ✓ {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="glass-panel-nested border-l-4 border-red-500 border-t border-b border-r border-card text-red-600 dark:text-red-400 p-4 rounded-sm shadow-2xl text-xs leading-relaxed">
              ⚠️ {errorMsg}
            </div>
          )}
        </div>
      )}

      {/* Off-canvas Custom Sidebar Overlay/Drawer for Mobile Viewport */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Dark blur glass backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Sliding Sidebar Sheet */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-72 max-w-[85vw] bg-card border-r border-border h-full flex flex-col justify-between p-6 z-10 shadow-2xl select-none text-foreground"
            >
              {/* Drawer Top Branding & Nav */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <Logo className="h-16 w-auto max-w-[180px] object-contain shrink-0" />

                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1.5 text-muted-foreground hover:text-foreground border border-border hover:bg-accent rounded-sm transition cursor-pointer"
                    aria-label="Fechar menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>



                <nav className="space-y-1.5 pt-2">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] px-3 mb-2 block">Menu do Negócio</div>
                  
                  <button
                    onClick={() => { setActiveTab('agenda'); setIsMobileMenuOpen(false); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${
                      activeTab === 'agenda' 
                        ? 'bg-primary text-primary-foreground shadow-lg font-bold' 
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <Calendar className="w-4 h-4" /> Agenda & Status
                  </button>

                  <button
                    onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${
                      activeTab === 'dashboard' 
                        ? 'bg-primary text-primary-foreground shadow-lg font-bold' 
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" /> Balanço Financeiro
                  </button>

                  <button
                    onClick={() => { setActiveTab('equipe'); setIsMobileMenuOpen(false); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${
                      activeTab === 'equipe'
                        ? 'bg-primary text-primary-foreground shadow-lg font-bold'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <Users className="w-4 h-4" /> Equipe
                  </button>

                  <button
                    onClick={() => { setActiveTab('servicos'); setIsMobileMenuOpen(false); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${
                      activeTab === 'servicos' 
                        ? 'bg-primary text-primary-foreground shadow-lg font-bold' 
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <Scissors className="w-4 h-4" /> Serviços CRUD
                  </button>

                  <button
                    onClick={() => { setActiveTab('produtos'); setIsMobileMenuOpen(false); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${
                      activeTab === 'produtos' 
                        ? 'bg-primary text-primary-foreground shadow-lg font-bold' 
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" /> Produtos CRUD
                  </button>

                  <button
                    onClick={() => { setActiveTab('clientes'); setIsMobileMenuOpen(false); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${
                      activeTab === 'clientes' 
                        ? 'bg-primary text-primary-foreground shadow-lg font-bold' 
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <Users className="w-4 h-4" /> Fichas de Clientes
                  </button>

                  <button
                    onClick={() => { setActiveTab('financeiro'); setIsMobileMenuOpen(false); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${
                      activeTab === 'financeiro' 
                        ? 'bg-primary text-primary-foreground shadow-lg font-bold' 
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" /> Fluxo de Caixa
                  </button>

                  <div className="border-t border-border my-4 pt-4">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] px-3 mb-2 block">Administração Geral</div>
                    <button
                      onClick={() => { setActiveTab('configuracoes'); setIsMobileMenuOpen(false); }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${
                        activeTab === 'configuracoes' 
                          ? 'bg-primary text-primary-foreground shadow-lg font-bold' 
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    >
                      <Sliders className="w-4 h-4" /> Escala e Bloqueios
                    </button>
                  </div>
                </nav>
              </div>

              {/* Bottom Sidebar Action */}
              <div className="p-4 border-t border-border bg-background/50 rounded-sm flex flex-col gap-3">
                {/* Plan Info Widget */}
                <div 
                  onClick={() => { setIsPlanModalOpen(true); setIsMobileMenuOpen(false); }}
                  className="p-3 bg-card border border-border/60 hover:border-primary/40 rounded-sm transition-all duration-200 cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-1">
                      <Sparkles className="w-3 h-3 animate-pulse text-primary" /> Plano 30 Dias
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground group-hover:text-muted-foreground transition-colors">
                      {planStats.elapsedDays}/{planStats.totalDays} dias
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-card h-1.5 rounded-full overflow-hidden mb-1.5">
                    <div 
                      className="bg-gradient-to-r from-primary/60 to-primary h-full rounded-full transition-all duration-500"
                      style={{ width: `${planStats.percent}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>Uso: {planStats.percent}%</span>
                    <span>Até: {planStats.cycleEnd.substring(0, 5)}</span>
                  </div>
                </div>

                <button
                  onClick={() => { onLogout(); setIsMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-sm text-xs font-semibold hover:text-primary text-muted-foreground hover:bg-accent/60 transition duration-150 flex items-center gap-2.5 uppercase tracking-wider cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-muted-foreground" /> Sair do Painel
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Left Sidebar Layout */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={onLogout} 
        setIsPlanModalOpen={setIsPlanModalOpen} 
        planStats={planStats} 
      />

      {/* Main Workspace Area (Right side) */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-background">
        {/* Sleek Horizontal Header inside Content Workspace */}
        <Header 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          setIsMobileMenuOpen={setIsMobileMenuOpen} 
          onOpenFinanceModal={() => {
            setShowFinanceForm(true);
            setTimeout(() => {
              const el = document.getElementById('finance-valor') as HTMLInputElement;
              if (el) el.focus();
            }, 100);
          }}
        />

        {/* Global Modal Popup de Lançamento Financeiro Rápido (Abre em qualquer aba) */}
        <AnimatePresence>
          {showFinanceForm && (
            <div 
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
              onClick={() => setShowFinanceForm(false)}
            >
              <div 
                className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden text-foreground space-y-5 p-6"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                      <Plus className="w-5 h-5 text-primary" /> Registrar Movimentação Financeira
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Digite o valor e os detalhes do lançamento para atualizar o saldo instantaneamente
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFinanceForm(false)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition cursor-pointer"
                    aria-label="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Form */}
                <form onSubmit={handleSaveFinanceLaunch} className="space-y-5">
                  {/* Tipo toggle — Entrada vs Saída */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      id="finance-type-entrada"
                      type="button"
                      onClick={() => {
                        setNewLaunch({ ...newLaunch, tipo: 'entrada' });
                        setTimeout(() => (document.getElementById('finance-valor') as HTMLInputElement)?.focus(), 50);
                      }}
                      className={`py-3 rounded-xl font-bold text-sm tracking-wide border-2 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        newLaunch.tipo === 'entrada'
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-900/30'
                          : 'bg-background border-border text-muted-foreground hover:border-emerald-600 hover:text-emerald-500'
                      }`}
                    >
                      <TrendingUp className="w-4 h-4" /> ENTRADA (Receita)
                    </button>
                    <button
                      id="finance-type-saida"
                      type="button"
                      onClick={() => {
                        setNewLaunch({ ...newLaunch, tipo: 'saida' });
                        setTimeout(() => (document.getElementById('finance-valor') as HTMLInputElement)?.focus(), 50);
                      }}
                      className={`py-3 rounded-xl font-bold text-sm tracking-wide border-2 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        newLaunch.tipo === 'saida'
                          ? 'bg-red-600 border-red-600 text-white shadow-md shadow-red-900/30'
                          : 'bg-background border-border text-muted-foreground hover:border-red-500 hover:text-red-500'
                      }`}
                    >
                      <TrendingDown className="w-4 h-4" /> SAÍDA (Despesa)
                    </button>
                  </div>

                  {/* Valor em destaque absoluto - autoFocus */}
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Valor (R$)</Label>
                    <div className="relative">
                      <span
                        className={`absolute left-4 top-1/2 -translate-y-1/2 font-extrabold text-3xl select-none pointer-events-none ${
                          newLaunch.tipo === 'entrada' ? 'text-emerald-500' : 'text-red-500'
                        }`}
                      >
                        R$
                      </span>
                      <input
                        id="finance-valor"
                        type="text"
                        inputMode="decimal"
                        required
                        autoFocus
                        value={newLaunch.valor}
                        onChange={(e) => {
                          let inputVal = e.target.value;
                          inputVal = inputVal.replace('.', ',');
                          const parts = inputVal.split(',');
                          if (parts.length > 2) return;
                          const integerPart = parts[0].replace(/[^0-9]/g, '');
                          let decimalPart = parts[1] !== undefined ? parts[1].replace(/[^0-9]/g, '').slice(0, 2) : undefined;
                          
                          if (decimalPart !== undefined) {
                            setNewLaunch({ ...newLaunch, valor: `${integerPart},${decimalPart}` });
                          } else {
                            setNewLaunch({ ...newLaunch, valor: integerPart });
                          }
                        }}
                        onBlur={() => {
                          if (!newLaunch.valor) return;
                          if (!newLaunch.valor.includes(',')) {
                            setNewLaunch({ ...newLaunch, valor: `${newLaunch.valor},00` });
                          } else {
                            const [int, dec] = newLaunch.valor.split(',');
                            const paddedDec = (dec || '').padEnd(2, '0');
                            setNewLaunch({ ...newLaunch, valor: `${int || '0'},${paddedDec}` });
                          }
                        }}
                        placeholder="0,00"
                        className="w-full pl-16 pr-4 py-4 text-3xl font-extrabold rounded-xl border border-border bg-background outline-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-muted-foreground/30 text-foreground"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Descrição (opcional)</Label>
                      <Input
                        type="text"
                        value={newLaunch.descricao}
                        onChange={(e) => setNewLaunch({ ...newLaunch, descricao: e.target.value })}
                        placeholder="Ex: Compra de golas higiênicas"
                        className="rounded-xl"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Categoria</Label>
                      <Select value={newLaunch.categoria} onValueChange={(v) => v && setNewLaunch({ ...newLaunch, categoria: v as string })}>
                        <SelectTrigger className="w-full rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categoriasFinanceiras.filter(c => c.tipo === newLaunch.tipo).map(cat => (
                            <SelectItem key={cat.id} value={cat.nome}>{cat.nome}</SelectItem>
                          ))}
                          {categoriasFinanceiras.filter(c => c.tipo === newLaunch.tipo).length === 0 && (
                            <SelectItem value="Serviços">Serviços</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Forma de Pagamento</Label>
                      <Select value={newLaunch.forma_pagamento} onValueChange={(v) => v && setNewLaunch({ ...newLaunch, forma_pagamento: v as any })}>
                        <SelectTrigger className="w-full rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="pix">Pix</SelectItem>
                          <SelectItem value="cartao">Cartão de débito/crédito</SelectItem>
                          <SelectItem value="outro">Outro método</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Data</Label>
                      <Input
                        type="date"
                        required
                        value={newLaunch.data}
                        onChange={(e) => setNewLaunch({ ...newLaunch, data: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Barbeiro receptor / pagador */}
                  {profissionais.filter(p => p.ativo).length > 1 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">
                        {newLaunch.tipo === 'entrada' ? 'Venda de qual barbeiro?' : 'Despesa de qual barbeiro?'}
                      </Label>
                      <Select
                        value={newLaunch.profissional_id || 'casa'}
                        onValueChange={(v) => setNewLaunch({ ...newLaunch, profissional_id: v === 'casa' ? '' : (v as string) })}
                      >
                        <SelectTrigger className="w-full rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="casa">Barbearia (Sem barbeiro específico)</SelectItem>
                          {profissionais.filter(p => p.ativo).map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowFinanceForm(false)}
                      className="w-1/3 py-3 rounded-xl text-xs uppercase font-bold cursor-pointer"
                    >
                      Cancelar
                    </Button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className={`w-2/3 py-3 rounded-xl font-bold text-sm tracking-wide text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md ${
                        newLaunch.tipo === 'entrada'
                          ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30'
                          : 'bg-red-600 hover:bg-red-500 shadow-red-900/30'
                      }`}
                    >
                      {submitting ? 'Salvando...' : newLaunch.tipo === 'entrada' ? '↑ Confirmar Entrada' : '↓ Confirmar Saída'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Content Panel (Expanded area) */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          
          {/* TAB 1: DASHBOARD FINANCIALS */}
          {activeTab === 'dashboard' && dashboardStats && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="font-normal text-2xl text-foreground tracking-tight">Balanço e Indicadores</h2>
                  <p className="text-muted-foreground text-xs mt-1">Visão financeira de faturamento concluído cruzado com despesas manuais</p>
                </div>

                {/* Period switcher */}
                <div className="flex bg-card p-1 border border-border rounded-sm text-xs font-semibold">
                  <button 
                    onClick={() => { setDashboardPeriod('today'); setDashboardCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-sm transition ${dashboardPeriod === 'today' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Hoje
                  </button>
                  <button 
                    onClick={() => { setDashboardPeriod('7'); setDashboardCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-sm transition ${dashboardPeriod === '7' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Últimos 7 dias
                  </button>
                  <button 
                    onClick={() => { setDashboardPeriod('30'); setDashboardCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-sm transition ${dashboardPeriod === '30' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    30 dias
                  </button>
                  <button 
                    onClick={() => { setDashboardPeriod('all'); setDashboardCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-sm transition ${dashboardPeriod === 'all' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Todo histórico
                  </button>
                </div>
              </div>

              <FiltroBarbeiro
                profissionais={profissionais}
                valor={filtroProfissional}
                onChange={(id) => { setFiltroProfissional(id); setDashboardCurrentPage(1); }}
              />

              {/* Stats bento cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card unificado: Cortes + Produtos = Faturamento Total */}
                <div 
                  onClick={() => setDashboardCardFilter(prev => prev === 'receitas' ? null : 'receitas')}
                  className={`p-4 bg-card border rounded-sm space-y-2 cursor-pointer transition-all duration-200 select-none hover:bg-accent ${
                    dashboardCardFilter === 'receitas' ? 'ring-2 ring-primary border-primary bg-card' : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Faturamento Total</span>
                    <Scissors className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-bold text-xl text-primary">{formatBRL(dashboardStats.faturamento + (dashboardStats.produtosVendidos || 0))}</h3>
                  <div className="flex items-center gap-3 pt-0.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Scissors className="w-3 h-3" />
                      {formatBRL(dashboardStats.faturamento)}
                    </p>
                    <span className="text-xs text-muted-foreground/40">|</span>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {formatBRL(dashboardStats.produtosVendidos || 0)}
                    </p>
                  </div>
                </div>

                <div
                  className="p-4 bg-card border border-border hover:border-primary/40 rounded-sm space-y-2 cursor-pointer transition-all duration-200 select-none hover:bg-accent"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Receita de Planos</span>
                    <DollarSign className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-bold text-xl text-primary">{formatBRL(dashboardStats.outrasEntradas || 0)}</h3>
                  <p className="text-xs text-muted-foreground">Assinaturas recorrentes</p>
                </div>

                <div
                  onClick={() => setDashboardCardFilter(prev => prev === 'despesas' ? null : 'despesas')}
                  className={`p-4 bg-card border rounded-sm space-y-2 cursor-pointer transition-all duration-200 select-none hover:bg-accent ${
                    dashboardCardFilter === 'despesas' ? 'ring-2 ring-red-500 border-red-500 bg-card' : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Despesas Totais</span>
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  </div>
                  <h3 className="font-bold text-xl text-red-600 dark:text-red-400">{formatBRL(dashboardStats.despesas)}</h3>
                  <p className="text-xs text-muted-foreground">Aluguel, insumos e custos</p>
                </div>

                <div
                  onClick={() => setDashboardCardFilter(prev => prev === 'lucro' ? null : 'lucro')}
                  className={`p-4 bg-card border rounded-sm space-y-2 cursor-pointer transition-all duration-200 select-none ${
                    dashboardCardFilter === 'lucro'
                      ? 'ring-2 ring-emerald-500 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                      : dashboardStats.lucro >= 0
                      ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-accent hover:border-emerald-500'
                      : 'border-red-500/40 text-red-600 dark:text-red-400 hover:bg-accent hover:border-red-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Lucro Líquido</span>
                    <DollarSign className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-bold text-xl">{dashboardStats.lucro >= 0 ? '+' : ''}{formatBRL(dashboardStats.lucro)}</h3>
                  <p className="text-xs text-muted-foreground">Saldo líquido final</p>
                </div>
              </div>

              {/* Quebra de faturamento por barbeiro no período.
                  Só aparece quando há mais de uma linha para comparar. */}
              {(dashboardStats.porProfissional?.length ?? 0) > 1 && (
                <div className="border border-border rounded-sm bg-card overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-border">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground">
                      Faturamento por barbeiro
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      No período selecionado. "Barbearia" reúne produtos e receitas sem barbeiro.
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {dashboardStats.porProfissional.map((linha) => {
                      const topo = dashboardStats.porProfissional[0]?.receita || 1;
                      const largura = Math.max(2, (linha.receita / topo) * 100);
                      return (
                        <div key={linha.profissional_id ?? 'casa'} className="px-5 py-3.5">
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <span className="text-xs font-semibold text-foreground truncate">
                              {linha.nome}
                            </span>
                            <div className="flex items-center gap-3 shrink-0">
                              {linha.atendimentos > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {linha.atendimentos} {linha.atendimentos === 1 ? 'atendimento' : 'atendimentos'}
                                </span>
                              )}
                              <span className="text-sm font-bold text-primary">
                                {formatBRL(linha.receita)}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-sm overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-sm transition-all duration-500"
                              style={{ width: `${largura}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Graphic bars summary (Craftsmanship over Defaults: dynamic CSS pure widgets) */}
              <div className="space-y-4">
                <h4 className="text-sm tracking-wide text-foreground font-semibold">
                  {dashboardCardFilter === 'receitas' && "Evolução do Faturamento Total (Cortes + Produtos)"}
                  {dashboardCardFilter === 'despesas' && "Evolução de Despesas Totais"}
                  {(dashboardCardFilter === null || dashboardCardFilter === 'lucro') && "Evolução de Lucro Líquido"}
                </h4>
                {dashboardStats.dailyChartData.length === 0 ? (
                  <div className="py-12 text-center bg-card border border-dashed border-border rounded-sm">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Nenhum faturamento registrado no período de filtragem escolhendo esta data.</p>
                  </div>
                ) : (
                  (() => {
                    const showYellow = dashboardCardFilter === 'receitas';
                    const showRed = dashboardCardFilter === 'despesas';
                    const showGreen = dashboardCardFilter === null || 
                                      dashboardCardFilter === 'lucro';

                    const maxChartValue = Math.max(
                      ...dashboardStats.dailyChartData.map(d => {
                        if (showYellow) return Math.max(d.receitas, 10);
                        if (showRed) return Math.max(d.despesas, 10);
                        return Math.max(Math.abs(d.lucro), 10);
                      })
                    );

                    return (
                      <div className="border border-border p-6 rounded-sm bg-background space-y-4">
                        <div className="relative w-full h-56 flex flex-col overflow-hidden">
                          {/* Y-Axis Labels + Plot Area Layout */}
                          <div className="relative w-full h-48 flex">
                            {/* Y-Axis Labels Column */}
                            <div className="w-10 sm:w-12 h-full flex flex-col justify-between items-end pr-1 sm:pr-2 py-2 select-none text-[10px] sm:text-[11px] font-medium text-foreground/80 leading-none shrink-0">
                              {[1, 0.75, 0.5, 0.25, 0].map((ratio, idx) => {
                                const currentVal = ratio * maxChartValue;
                                return (
                                  <span key={idx} className="whitespace-nowrap">
                                    {ratio === 0 ? 'R$ 0' : formatBRL(currentVal).split(',')[0]}
                                  </span>
                                );
                              })}
                            </div>

                            {/* SVG Plot Graphic */}
                            <div className="relative flex-1 h-full min-w-0">
                              <svg viewBox="0 0 540 180" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                                <defs>
                                  <linearGradient id="yellow-glow" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#c5a059" stopOpacity="0.25" />
                                    <stop offset="100%" stopColor="#c5a059" stopOpacity="0.0" />
                                  </linearGradient>
                                  <linearGradient id="red-glow" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
                                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                                  </linearGradient>
                                  <linearGradient id="green-glow" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                                  </linearGradient>
                                </defs>

                                {/* Y-axis grid lines (Cartesian style) */}
                                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                                  const yPos = 170 - ratio * 150;
                                  return (
                                    <line 
                                      key={idx}
                                      x1="0" 
                                      y1={yPos} 
                                      x2="540" 
                                      y2={yPos} 
                                      stroke="rgba(197, 160, 89, 0.15)" 
                                      strokeDasharray="3,3" 
                                      strokeWidth="1" 
                                    />
                                  );
                                })}

                                {/* Axis baseline */}
                                <line x1="0" y1="170" x2="540" y2="170" stroke="rgba(197, 160, 89, 0.3)" strokeWidth="1" />

                                {/* Plot lines and area */}
                                {(() => {
                                  const availableWidth = 540;
                                  const len = dashboardStats.dailyChartData.length;

                                  const getX = (index: number) => len > 1 ? (index * (availableWidth / (len - 1))) : availableWidth / 2;
                                  const getY = (val: number) => {
                                    const ratio = Math.max(0, val) / maxChartValue;
                                    return 170 - (ratio * 150);
                                  };

                                  const yellowPoints = dashboardStats.dailyChartData.map((d, idx) => ({ x: getX(idx), y: getY(d.receitas), data: d }));
                                  const redPoints = dashboardStats.dailyChartData.map((d, idx) => ({ x: getX(idx), y: getY(d.despesas), data: d }));
                                  const greenPoints = dashboardStats.dailyChartData.map((d, idx) => ({ x: getX(idx), y: getY(d.lucro), data: d }));

                                  const yellowLinePath = yellowPoints.map((p, index) => `${index === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                  const redLinePath = redPoints.map((p, index) => `${index === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                  const greenLinePath = greenPoints.map((p, index) => `${index === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                                  const yellowAreaPath = yellowPoints.length > 0 ? `${yellowLinePath} L ${yellowPoints[yellowPoints.length - 1].x} 170 L ${yellowPoints[0].x} 170 Z` : '';
                                  const redAreaPath = redPoints.length > 0 ? `${redLinePath} L ${redPoints[redPoints.length - 1].x} 170 L ${redPoints[0].x} 170 Z` : '';
                                  const greenAreaPath = greenPoints.length > 0 ? `${greenLinePath} L ${greenPoints[greenPoints.length - 1].x} 170 L ${greenPoints[0].x} 170 Z` : '';

                                  const hoverReferencePoints = showYellow ? yellowPoints : (showRed ? redPoints : greenPoints);

                                  return (
                                    <>
                                      {/* Glowing bottom areas */}
                                      {showYellow && yellowAreaPath && (
                                        <path d={yellowAreaPath} fill="url(#yellow-glow)" className="transition-all duration-500" />
                                      )}
                                      {showRed && redAreaPath && (
                                        <path d={redAreaPath} fill="url(#red-glow)" className="transition-all duration-500" />
                                      )}
                                      {showGreen && greenAreaPath && (
                                        <path d={greenAreaPath} fill="url(#green-glow)" className="transition-all duration-500" />
                                      )}

                                      {/* Highlight Lines */}
                                      {showYellow && yellowLinePath && (
                                        <path 
                                          d={yellowLinePath} 
                                          fill="none" 
                                          stroke="#c5a059" 
                                          strokeWidth="2.5" 
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          className="transition-all duration-500 drop-shadow-[0_2px_4px_rgba(197,160,89,0.35)]"
                                        />
                                      )}
                                      {showRed && redLinePath && (
                                        <path 
                                          d={redLinePath} 
                                          fill="none" 
                                          stroke="#ef4444" 
                                          strokeWidth="2.5" 
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          className="transition-all duration-500 drop-shadow-[0_2px_4px_rgba(239,68,68,0.3)]"
                                        />
                                      )}
                                      {showGreen && greenLinePath && (
                                        <path 
                                          d={greenLinePath} 
                                          fill="none" 
                                          stroke="#10b981" 
                                          strokeWidth="2.5" 
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          className="transition-all duration-500 drop-shadow-[0_2px_4px_rgba(16,185,129,0.3)]"
                                        />
                                      )}

                                      {hoverReferencePoints.map((p, index) => {
                                        const dotY = showYellow ? getY(p.data.receitas) : (showRed ? getY(p.data.despesas) : getY(p.data.lucro));
                                        return (
                                          <g key={index} className="group cursor-pointer">
                                            <foreignObject
                                              x={Math.max(p.x - 75, 5)}
                                              y={Math.min(Math.max(dotY - 85, 5), 100)}
                                              width="150"
                                              height="85"
                                              className="opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50 overflow-visible"
                                            >
                                              <div className="bg-background/95 border border-border text-muted-foreground text-xs p-1.5 rounded-sm shadow-2xl space-y-0.5 leading-tight select-none">
                                                <div className="font-bold text-foreground text-center border-b border-border pb-0.5 mb-1">
                                                  {p.data.data.includes(':') ? `Hoje, às ${p.data.data}` : p.data.data.split('-').reverse().join('/')}
                                                </div>
                                                
                                                {showYellow && (
                                                  <div className="flex justify-between gap-2">
                                                    <span className="text-primary">Faturamento:</span>
                                                    <span className="font-bold text-primary">{formatBRL(p.data.receitas)}</span>
                                                  </div>
                                                )}
                                                {showRed && (
                                                  <div className="flex justify-between gap-2">
                                                    <span className="text-red-600 dark:text-red-400">Despesas:</span>
                                                    <span className="font-bold text-red-600 dark:text-red-400">{formatBRL(p.data.despesas)}</span>
                                                  </div>
                                                )}
                                                {showGreen && (
                                                  <div className="flex justify-between gap-1">
                                                    <span className="text-emerald-600 dark:text-emerald-400">Lucro Líquido:</span>
                                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatBRL(p.data.lucro)}</span>
                                                  </div>
                                                )}
                                              </div>
                                            </foreignObject>
                                          </g>
                                        );
                                      })}
                                    </>
                                  );
                                })()}
                              </svg>
                            </div>
                          </div>

                          {/* X-Axis Labels Row (HTML Flex - Responsive step calculation for mobile) */}
                          <div className="w-full pl-10 sm:pl-12 flex justify-between items-center pt-2 text-[9px] sm:text-[11px] font-medium text-foreground/75 select-none overflow-hidden">
                            {(() => {
                              const totalItems = dashboardStats.dailyChartData.length;
                              // Em telas pequenas (mobile), pula rótulos se houver mais de 5 itens para não espremer
                              return dashboardStats.dailyChartData.map((d, index) => {
                                const rawLabel = d.data.includes(':') ? d.data.split(':')[0] + 'h' : d.data.split('-').slice(1).reverse().join('/');
                                const isMobileHide = totalItems > 6 && index % 2 !== 0 && index !== totalItems - 1;
                                return (
                                  <span 
                                    key={index} 
                                    className={`text-center transition-opacity ${isMobileHide ? 'hidden sm:inline-block' : 'inline-block'}`}
                                  >
                                    {rawLabel}
                                  </span>
                                );
                              });
                            })()}
                          </div>
                        </div>

                        {/* Compact descriptive chart legend */}
                        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 border-t border-border/60 text-xs text-muted-foreground select-none">
                          {showYellow && (
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                              <span>Faturamento (Cortes & Serviços)</span>
                            </div>
                          )}
                          {showRed && (
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                              <span>Despesas Totais</span>
                            </div>
                          )}
                          {showGreen && (
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                              <span>Lucro Líquido</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Recent activity history logs (shows auto insertion) */}
              <div className="space-y-4">
                <h4 className="text-sm tracking-wide text-foreground font-semibold">Últimas Transações Registradas</h4>
                <div className="overflow-x-auto rounded-sm border border-border bg-card">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-background border-b border-border text-muted-foreground font-semibold text-xs uppercase tracking-wider">
                        <th className="p-3">Data</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Descrição</th>
                        <th className="p-3">Categoria</th>
                        <th className="p-3">Pagamento</th>
                        <th className="p-3 text-right">Valor</th>
                        <th className="p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-850 font-sans text-muted-foreground">
                      {(() => {
                        let list = [...dashboardStats.history];
                        if (dashboardCardFilter === 'cortes') {
                          list = list.filter(h => h.tipo === 'entrada' && (h.categoria === 'Serviço de Corte' || h.agendamento_id !== null));
                        } else if (dashboardCardFilter === 'produtos') {
                          list = list.filter(h => {
                            return h.tipo === 'entrada' && h.agendamento_id === null && (
                              h.produto_id !== null || 
                              h.categoria === 'Produtos' || 
                              h.categoria === 'Venda de Produtos' || 
                              h.categoria === 'Venda de Produto' || 
                              h.categoria.toLowerCase().includes('produto') ||
                              h.descricao.toLowerCase().includes('produto')
                            );
                          });
                        } else if (dashboardCardFilter === 'despesas') {
                          list = list.filter(h => h.tipo === 'saida');
                        } // 'lucro' acts as showing all since all items contribute to net profit
                        
                        if (list.length === 0) {
                          return (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs uppercase tracking-wider">
                                Nenhuma transação correspondente encontrada para este filtro.
                              </td>
                            </tr>
                          );
                        }

                        const totalLogs = list.length;
                        const totalPages = Math.ceil(totalLogs / dashboardLogsPerPage) || 1;
                        const activePage = Math.min(dashboardCurrentPage, totalPages);
                        const indexOfLastLog = activePage * dashboardLogsPerPage;
                        const indexOfFirstLog = indexOfLastLog - dashboardLogsPerPage;
                        const currentLogs = list.slice(indexOfFirstLog, indexOfLastLog);

                        return currentLogs.map((h, i) => (
                          <tr key={h.id} className="hover:bg-accent/30">
                            <td className="p-3 text-xs">{h.data.split('-').reverse().join('/')}</td>
                            <td className="p-3">
                              <span className={`inline-block px-2 py-0.5 rounded-sm text-xs uppercase tracking-wider font-semibold ${
                                h.tipo === 'entrada' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40' : 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/45'
                              }`}>
                                {h.tipo === 'entrada' ? 'entrada' : 'despesa'}
                              </span>
                            </td>
                            <td className="p-3 font-medium text-foreground">{h.descricao}</td>
                            <td className="p-3 text-muted-foreground">{h.categoria}</td>
                            <td className="p-3 capitalize text-xs text-muted-foreground">{h.forma_pagamento}</td>
                            <td className={`p-3 text-right font-bold ${
                              h.tipo === 'entrada' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                              {h.tipo === 'entrada' ? '+' : '-'}{formatBRL(h.valor)}
                            </td>
                            <td className="p-3 text-right space-x-1 whitespace-nowrap">
                              <button
                                onClick={() => handleEditFinanceClick(h)}
                                className="p-1 text-muted-foreground hover:text-primary transition-colors"
                                title="Editar lançamento"
                              >
                                <Edit className="w-3.5 h-3.5 inline" />
                              </button>
                              <button
                                onClick={() => handleDeleteFinance(h.id)}
                                className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                                title="Excluir do balanço"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline" />
                              </button>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls block */}
                {(() => {
                  let list = [...dashboardStats.history];
                  if (dashboardCardFilter === 'cortes') {
                    list = list.filter(h => h.tipo === 'entrada' && (h.categoria === 'Serviço de Corte' || h.agendamento_id !== null));
                  } else if (dashboardCardFilter === 'produtos') {
                    list = list.filter(h => {
                      return h.tipo === 'entrada' && h.agendamento_id === null && (
                        h.produto_id !== null || 
                        h.categoria === 'Produtos' || 
                        h.categoria === 'Venda de Produtos' || 
                        h.categoria === 'Venda de Produto' || 
                        h.categoria.toLowerCase().includes('produto') ||
                        h.descricao.toLowerCase().includes('produto')
                      );
                    });
                  } else if (dashboardCardFilter === 'despesas') {
                    list = list.filter(h => h.tipo === 'saida');
                  }

                  const totalLogs = list.length;
                  const totalPages = Math.ceil(totalLogs / dashboardLogsPerPage) || 1;
                  const activePage = Math.min(dashboardCurrentPage, totalPages);
                  const indexOfLastLog = activePage * dashboardLogsPerPage;
                  const indexOfFirstLog = indexOfLastLog - dashboardLogsPerPage;

                  if (totalPages <= 1) return null;

                  return (
                    <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground gap-4">
                      <div>
                        Mostrando <span className="font-bold text-muted-foreground">{indexOfFirstLog + 1}</span> a{' '}
                        <span className="font-bold text-muted-foreground">{Math.min(indexOfLastLog, totalLogs)}</span> de{' '}
                        <span className="font-bold text-muted-foreground">{totalLogs}</span> transações
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={activePage === 1}
                          onClick={() => setDashboardCurrentPage(p => Math.max(p - 1, 1))}
                          className="px-3 py-1.5 bg-card border border-border rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 transition cursor-pointer"
                        >
                          &larr; Anterior
                        </button>
                        <span className="text-muted-foreground font-sans text-xs">
                          Página <span className="font-bold text-primary">{activePage}</span> de <span>{totalPages}</span>
                        </span>
                        <button
                          type="button"
                          disabled={activePage === totalPages}
                          onClick={() => setDashboardCurrentPage(p => Math.min(p + 1, totalPages))}
                          className="px-3 py-1.5 bg-card border border-border rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 transition cursor-pointer"
                        >
                          Próxima &rarr;
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}


          {/* TAB 2: DAILY AGENDA & CHOOSE STATUS */}
          {activeTab === 'agenda' && (
            <div className="space-y-6">
              {/* Header & Main Action */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="font-normal text-2xl text-foreground tracking-tight">Agenda de Compromissos</h2>
                    <p className="text-muted-foreground text-xs mt-1">Mude o status de agendamentos e consulte relatórios de clientes</p>
                  </div>

                  {/* Desktop Novo Agendamento Button */}
                  <Button
                    onClick={() => { setSlotInicial(undefined); setIsManualBookingModalOpen(true); }}
                    className="hidden sm:flex bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold uppercase tracking-wider px-4 py-2.5 items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" /> Novo Agendamento
                  </Button>
                </div>

                {/* Mobile Novo Agendamento Button (Centered, Large, Prominent) */}
                <div className="sm:hidden w-full">
                  <Button
                    onClick={() => { setSlotInicial(undefined); setIsManualBookingModalOpen(true); }}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold uppercase tracking-wider py-3 flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-[0.99]"
                  >
                    <Plus className="w-5 h-5" /> Novo Agendamento
                  </Button>
                </div>

              </div>

              <FiltroBarbeiro
                profissionais={profissionais}
                valor={filtroProfissional}
                onChange={setFiltroProfissional}
              />

              <AgendaSemanal
                agendamentos={filtroProfissional ? agendamentos.filter(a => a.profissional_id === filtroProfissional) : agendamentos}
                profissionais={profissionais}
                servicos={servicos}
                onSlotClick={(data, horario) => {
                  setSlotInicial({ data, horario });
                  setIsManualBookingModalOpen(true);
                }}
                onAgendamentoClick={(a) => setAgendamentoDetalhe(a)}
              />
            </div>
          )}


          {/* TAB 3: SERVICES CRUD */}
          {activeTab === 'equipe' && (
            <EquipeTab profissionais={profissionais} onChanged={fetchProfissionais} />
          )}

          {activeTab === 'servicos' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-normal text-2xl text-foreground tracking-tight">Catálogo de Serviços</h2>
                  <p className="text-muted-foreground text-xs mt-1">Crie e edite preços, descrições e durações dos serviços no site público</p>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    if (showServiceForm) {
                      setEditingServiceId(null);
                      setNewService({ nome: '', descricao: '', preco: '', duracao_minutos: '45', imagem_url: '' });
                    }
                    setShowServiceForm(v => !v);
                  }}
                  className="shrink-0"
                >
                  <Plus className="w-4 h-4" /> {showServiceForm ? 'Fechar' : 'Novo Serviço'}
                </Button>
              </div>

              {/* Service Form */}
              {showServiceForm && (
              <form id="service-form-anchor" onSubmit={handleSaveService} className="bg-card p-6 rounded-lg border border-border grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground mb-2">
                    {editingServiceId ? 'Modificar Serviço Existente' : 'Cadastrar Novo Serviço'}
                  </h4>
                </div>

                <div className="space-y-1.5">
                  <Label>Nome do serviço</Label>
                  <Input
                    type="text"
                    required
                    value={newService.nome}
                    onChange={(e) => setNewService({ ...newService, nome: e.target.value })}
                    placeholder="Ex: Alinhamento de Cavanhaque"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Preço cobrado (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={newService.preco}
                    onChange={(e) => setNewService({ ...newService, preco: e.target.value })}
                    placeholder="Ex: 35.00"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Duração (minutos)</Label>
                  <Input
                    type="number"
                    required
                    value={newService.duracao_minutos}
                    onChange={(e) => setNewService({ ...newService, duracao_minutos: e.target.value })}
                    placeholder="Ex: 30"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Foto do serviço</Label>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-sm bg-background border border-border overflow-hidden shrink-0 flex items-center justify-center">
                      {newService.imagem_url ? (
                        <img src={newService.imagem_url} className="w-full h-full object-cover" />
                      ) : (
                        <Upload className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <label className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 border border-dashed border-border rounded-sm text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground transition ${uploadingServiceImage ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                      {uploadingServiceImage ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</>
                      ) : (
                        <><Upload className="w-3.5 h-3.5" /> {newService.imagem_url ? 'Trocar imagem' : 'Enviar imagem'}</>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={uploadingServiceImage}
                        onChange={(e) => handleServiceImageSelect(e.target.files?.[0])}
                      />
                    </label>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <Label>Descrição comercial do serviço</Label>
                  <Textarea
                    rows={2}
                    value={newService.descricao}
                    onChange={(e) => setNewService({ ...newService, descricao: e.target.value })}
                    placeholder="Escreva detalhes adicionais sobre o atendimento, café incluso, etc..."
                  />
                </div>

                <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-border">
                  {editingServiceId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingServiceId(null);
                        setNewService({ nome: '', descricao: '', preco: '', duracao_minutos: '45', imagem_url: '' });
                        setShowServiceForm(false);
                      }}
                    >
                      Cancelar Edição
                    </Button>
                  )}
                  <Button type="submit" disabled={submitting}>
                    <Save className="w-4 h-4" /> {editingServiceId ? 'Salvar Alteração' : 'Adicionar Serviço'}
                  </Button>
                </div>
              </form>
              )}

              {/* Service showcase grid for admin control */}
              <div className="space-y-3">
                <h4 className="text-sm tracking-wide text-foreground font-semibold">Vitrine de Serviços ({servicos.length})</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {servicos.map(s => (
                    <div
                      key={s.id}
                      className={`group rounded-sm border overflow-hidden transition-all ${
                        s.ativo ? 'border-border bg-card hover:border-primary/40' : 'border-border bg-card/40 opacity-60'
                      }`}
                    >
                      <div className="aspect-video w-full bg-background overflow-hidden">
                        <img src={s.imagem_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="font-sans font-semibold text-foreground text-sm">{s.nome}</h5>
                          <Badge
                            className={`shrink-0 text-xs uppercase tracking-wider font-bold ${
                              s.ativo
                                ? 'bg-primary/10 text-primary border border-primary/25'
                                : 'bg-card text-muted-foreground border border-border'
                            }`}
                          >
                            {s.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                        {s.descricao && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{s.descricao}</p>
                        )}
                        <div className="flex items-center justify-between pt-1">
                          <span className="font-bold text-xl text-primary">{formatBRL(s.preco)}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {s.duracao_minutos} min
                          </span>
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-border">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleEditServiceSelect(s)}
                          >
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant={s.ativo ? 'ghost' : 'secondary'}
                            size="sm"
                            className="flex-1"
                            onClick={() => handleToggleServiceActive(s)}
                          >
                            {s.ativo ? 'Desativar' : 'Ativar'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}


          {/* TAB 3b: PLANOS (assinantes distribuídos entre os 3 tiers: Essential/Premium/Exclusive) */}
          {activeTab === 'planos' && (
            <div className="space-y-8">
              <div>
                <h2 className="font-normal text-2xl text-foreground tracking-tight">Configurar Planos</h2>
                <p className="text-muted-foreground text-xs mt-1">Acompanhe quem está assinado em cada plano recorrente e quem está com a renovação atrasada.</p>
              </div>

              {/* Planos de referência (configurados no checkout do cliente; não editáveis neste painel) */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground">Planos Configurados</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {PLAN_TIERS.map(tier => (
                    <div key={tier.key} className={`rounded-sm border bg-card overflow-hidden ${tier.borderClass}`}>
                      <div className="p-5 space-y-3">
                        <h5 className={`text-xs font-bold uppercase tracking-[0.2em] ${tier.textClass}`}>{tier.label}</h5>
                        <div className="text-2xl font-bold text-primary">
                          {formatBRL(tier.price)}<span className="text-xs text-muted-foreground font-normal">/mês</span>
                        </div>
                        <ul className="space-y-1.5 pt-2 border-t border-border">
                          {tier.features.map(feature => (
                            <li key={feature} className="flex items-center gap-2 text-xs text-foreground">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Cobrança recorrente no cartão via Stripe. A edição dos planos é feita no fluxo de checkout do cliente.</p>
              </div>

              {/* Resumo de assinantes por plano */}
              <div className={`grid grid-cols-1 sm:grid-cols-3 ${assinantesOutrosPlanos.length > 0 ? 'lg:grid-cols-4' : ''} gap-4`}>
                {assinantesPorPlano.map(({ tier, subs }) => {
                  const renovados = subs.filter(a => a.renovado).length;
                  const naoRenovados = subs.length - renovados;
                  return (
                    <div key={tier.key} className="p-4 bg-card border border-border rounded-sm space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs uppercase tracking-wider font-bold ${tier.textClass}`}>{tier.label}</span>
                        <h3 className="font-bold text-xl text-foreground">{subs.length}</h3>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-semibold">
                        <span className="text-emerald-600 dark:text-emerald-400">{renovados} renovado{renovados === 1 ? '' : 's'}</span>
                        <span className="text-red-600 dark:text-red-400">{naoRenovados} não renovado{naoRenovados === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                  );
                })}
                {assinantesOutrosPlanos.length > 0 && (
                  <div className="p-4 bg-card border border-dashed border-border rounded-sm space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Outros / Legado</span>
                      <h3 className="font-bold text-xl text-foreground">{assinantesOutrosPlanos.length}</h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-semibold">
                      <span className="text-emerald-600 dark:text-emerald-400">{assinantesOutrosPlanos.filter(a => a.renovado).length} renovado(s)</span>
                      <span className="text-red-600 dark:text-red-400">{assinantesOutrosPlanos.filter(a => !a.renovado).length} não renovado(s)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Lista de assinantes */}
              <div className="space-y-3">
                <h4 className="text-sm tracking-wide text-foreground font-semibold">Clientes Assinantes ({assinantesVIP.length})</h4>
                {assinantesVIP.length === 0 ? (
                  <div className="py-12 text-center bg-card border border-dashed border-border rounded-sm">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Nenhum cliente assinou um plano ainda.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-sm border border-border bg-card">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-background border-b border-border text-muted-foreground font-semibold text-xs uppercase tracking-wider">
                          <th className="p-3">Cliente</th>
                          <th className="p-3">Plano</th>
                          <th className="p-3">Telefone</th>
                          <th className="p-3">Cartão</th>
                          <th className="p-3">Renova em</th>
                          <th className="p-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assinantesVIP.map(({ cliente, subscription, renovado }) => (
                          <tr key={cliente.id} className="border-b border-border last:border-b-0">
                            <td className="p-3 font-semibold text-foreground">{cliente.nome}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-sm text-xs font-bold uppercase tracking-wider border ${planBadgeClass(subscription.plan || '')}`}>
                                {planLabel(subscription.plan || '')}
                              </span>
                            </td>
                            <td className="p-3 text-muted-foreground">{cliente.telefone}</td>
                            <td className="p-3 text-muted-foreground">
                              {subscription.card_brand ? `${subscription.card_brand} •••• ${subscription.card_last4}` : '—'}
                            </td>
                            <td className="p-3 text-muted-foreground">
                              {new Date(subscription.renews_at).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="p-3 text-right">
                              <span className={`px-2 py-0.5 rounded-sm text-xs font-bold uppercase tracking-wider border ${
                                renovado
                                  ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40'
                                  : 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/40'
                              }`}>
                                {renovado ? 'Renovado' : 'Não Renovado'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PRODUCTS CRUD */}
          {activeTab === 'produtos' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-normal text-2xl text-foreground tracking-tight">Gestão de Produtos / Estoque</h2>
                  <p className="text-muted-foreground text-xs mt-1">Exponha pomadas e shampoos na vitrine e modifique as unidades de estoque</p>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    if (showProductForm) {
                      setEditingProductId(null);
                      setNewProduct({ nome: '', descricao: '', preco: '', estoque: '10', imagem_url: '' });
                    }
                    setShowProductForm(v => !v);
                  }}
                  className="shrink-0"
                >
                  <Plus className="w-4 h-4" /> {showProductForm ? 'Fechar' : 'Novo Produto'}
                </Button>
              </div>

              {/* Product Form */}
              {showProductForm && (
              <form id="product-form-anchor" onSubmit={handleSaveProduct} className="bg-card p-6 rounded-lg border border-border grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground mb-2">
                    {editingProductId ? 'Modificar Estoque / Descrição' : 'Cadastrar Novo Item'}
                  </h4>
                </div>

                <div className="space-y-1.5">
                  <Label>Nome do cosmético</Label>
                  <Input
                    type="text"
                    required
                    value={newProduct.nome}
                    onChange={(e) => setNewProduct({ ...newProduct, nome: e.target.value })}
                    placeholder="Ex: Cera Modeladora Molhada"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Preço de venda (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={newProduct.preco}
                    onChange={(e) => setNewProduct({ ...newProduct, preco: e.target.value })}
                    placeholder="Ex: 40.00"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Unidades em estoque</Label>
                  <Input
                    type="number"
                    required
                    value={newProduct.estoque}
                    onChange={(e) => setNewProduct({ ...newProduct, estoque: e.target.value })}
                    placeholder="Ex: 10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Foto do produto</Label>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-sm bg-background border border-border overflow-hidden shrink-0 flex items-center justify-center">
                      {newProduct.imagem_url ? (
                        <img src={newProduct.imagem_url} className="w-full h-full object-cover" />
                      ) : (
                        <Upload className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <label className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 border border-dashed border-border rounded-sm text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground transition ${uploadingProductImage ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                      {uploadingProductImage ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</>
                      ) : (
                        <><Upload className="w-3.5 h-3.5" /> {newProduct.imagem_url ? 'Trocar imagem' : 'Enviar imagem'}</>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={uploadingProductImage}
                        onChange={(e) => handleProductImageSelect(e.target.files?.[0])}
                      />
                    </label>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <Label>Especificações e volumetria</Label>
                  <Textarea
                    rows={2}
                    value={newProduct.descricao}
                    onChange={(e) => setNewProduct({ ...newProduct, descricao: e.target.value })}
                    placeholder="Ex: Efeito molhado, brilho intenso com óleo de coco protetor. 150g."
                  />
                </div>

                <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-border">
                  {editingProductId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingProductId(null);
                        setNewProduct({ nome: '', descricao: '', preco: '', estoque: '10', imagem_url: '' });
                        setShowProductForm(false);
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button type="submit" disabled={submitting}>
                    <Save className="w-4 h-4" /> {editingProductId ? 'Atualizar Cosmos' : 'Adicionar Cosmético'}
                  </Button>
                </div>
              </form>
              )}

              {/* Product showcase grid + stock control */}
              <div className="space-y-3">
                <h4 className="text-sm tracking-wide text-foreground font-semibold">Vitrine & Estoque ({produtos.length})</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {produtos.map(p => (
                    <div
                      key={p.id}
                      className={`group rounded-sm border overflow-hidden transition-all ${
                        p.ativo ? 'border-border bg-card hover:border-primary/40' : 'border-border bg-card/40 opacity-60'
                      }`}
                    >
                      <div className="aspect-video w-full bg-background overflow-hidden">
                        <img src={p.imagem_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="font-sans font-semibold text-foreground text-sm">{p.nome}</h5>
                          <Badge
                            className={`shrink-0 text-xs uppercase tracking-wider font-bold ${
                              p.ativo
                                ? 'bg-primary/10 text-primary border border-primary/25'
                                : 'bg-card text-muted-foreground border border-border'
                            }`}
                          >
                            {p.ativo ? 'Exibido' : 'Oculto'}
                          </Badge>
                        </div>
                        {p.descricao && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{p.descricao}</p>
                        )}
                        <div className="flex items-center justify-between pt-1">
                          <span className="font-bold text-xl text-primary">{formatBRL(p.preco)}</span>
                          <Badge
                            className={`text-xs uppercase tracking-wider font-bold ${
                              p.estoque <= 3
                                ? 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40'
                                : 'bg-card text-muted-foreground border border-border'
                            }`}
                          >
                            {p.estoque <= 3 ? 'Estoque baixo' : `${p.estoque} un.`}
                          </Badge>
                        </div>

                        {/* Quick stock adjust */}
                        <div className="flex items-center justify-center gap-3 py-1">
                          <button
                            type="button"
                            onClick={() => handleAdjustStock(p, -1)}
                            disabled={p.estoque <= 0}
                            className="p-1.5 border border-border rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-bold text-sm text-foreground w-10 text-center">{p.estoque} un.</span>
                          <button
                            type="button"
                            onClick={() => handleAdjustStock(p, 1)}
                            className="p-1.5 border border-border rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-border">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleEditProductSelect(p)}
                          >
                            Modificar
                          </Button>
                          <Button
                            type="button"
                            variant={p.ativo ? 'ghost' : 'secondary'}
                            size="sm"
                            className="flex-1"
                            onClick={() => handleToggleProductActive(p)}
                          >
                            {p.ativo ? 'Ocultar' : 'Exibir'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}


          {/* TAB 5: CLIENTS CRUD */}
          {activeTab === 'clientes' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-normal text-2xl text-foreground tracking-tight">Cadastro de Clientes</h2>
                  <p className="text-muted-foreground text-xs mt-1">Crie prontuários, registre limitações térmicas, químicas ou de preferência de cada cliente</p>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    if (showClientForm) {
                      setEditingClientId(null);
                      setNewClient({ nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '', senha: '' });
                    }
                    setShowClientForm(v => !v);
                  }}
                  className="shrink-0"
                >
                  <Plus className="w-4 h-4" /> {showClientForm ? 'Fechar' : 'Novo Cliente'}
                </Button>
              </div>

              {/* Client Form */}
              {showClientForm && (
              <form onSubmit={handleSaveClient} className="bg-card p-6 rounded-lg border border-border grid grid-cols-1 md:grid-cols-2 gap-5" id="client-form-anchor">
                <div className="md:col-span-2">
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground mb-2">
                    {editingClientId ? 'Atualizar Observações Técnicas' : 'Inserir Nova Ficha ao prontuário'}
                  </h4>
                </div>

                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input
                    type="text"
                    required
                    value={newClient.nome}
                    onChange={(e) => setNewClient({ ...newClient, nome: e.target.value })}
                    placeholder="Nome completo do cliente"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Telefone / Celular</Label>
                  <Input
                    type="tel"
                    required
                    value={newClient.telefone}
                    onChange={(e) => setNewClient({ ...newClient, telefone: e.target.value })}
                    placeholder="Ex: (11) 98765-1234"
                  />
                </div>

                {!editingClientId && (
                  <div className="space-y-1.5">
                    <Label>Senha de acesso ao app (opcional)</Label>
                    <Input
                      type="text"
                      value={newClient.senha}
                      onChange={(e) => setNewClient({ ...newClient, senha: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      minLength={6}
                    />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Combine a senha com o cliente. Ele entra no app com o telefone e essa senha.
                      Deixe em branco para só criar a ficha, sem login.
                    </p>
                  </div>
                )}

                {/* O e-mail some quando há senha: o cliente com login por telefone precisa
                    ter clientes.email igual ao e-mail sintético, senão o webhook do Stripe
                    não acha a ficha e o cliente paga sem virar VIP. */}
                {!newClient.senha && (
                  <div className="space-y-1.5">
                    <Label>E-mail (opcional)</Label>
                    <Input
                      type="email"
                      value={newClient.email}
                      onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                      placeholder="cliente@exemplo.com"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Data de nascimento (opcional)</Label>
                  <Input
                    type="date"
                    value={newClient.data_nascimento}
                    onChange={(e) => setNewClient({ ...newClient, data_nascimento: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <Label>Observações técnicas do Barbeiro</Label>
                  <Textarea
                    rows={1}
                    value={newClient.observacoes}
                    onChange={(e) => setNewClient({ ...newClient, observacoes: e.target.value })}
                    placeholder="Preferências, pomadas, degradê, etc..."
                  />
                </div>

                <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-border">
                  {editingClientId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingClientId(null);
                        setNewClient({ nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '', senha: '' });
                        setShowClientForm(false);
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button type="submit" disabled={submitting}>
                    <Save className="w-4 h-4" /> {editingClientId ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                  </Button>
                </div>
              </form>
              )}

              {/* Clients database list */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h4 className="text-sm tracking-wide text-foreground font-semibold">Histórico de Prontuários ({clientes.length})</h4>
                  <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      type="text"
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      placeholder="Buscar por nome ou telefone..."
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {clientes
                    .filter(c => {
                      const query = clientSearchQuery.trim().toLowerCase();
                      if (!query) return true;
                      const digitsQuery = query.replace(/\D/g, '');
                      const matchesName = c.nome.toLowerCase().includes(query);
                      const matchesPhone = digitsQuery.length > 0 && c.telefone.replace(/\D/g, '').includes(digitsQuery);
                      return matchesName || matchesPhone;
                    })
                    .map(c => {
                    const vipEntry = assinantesVIP.find(a => a.cliente.id === c.id);
                    return (
                    <div 
                      key={c.id} 
                      onClick={() => {
                        handleEditClientSelect(c);
                        const formAnchor = document.getElementById('client-form-anchor');
                        if (formAnchor) {
                          formAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                      className="p-4 bg-card border border-border rounded-sm hover:border-primary transition-all flex flex-col justify-between space-y-3 cursor-pointer group"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            {/* Profile Image Circular Avatar */}
                            <div className="w-10 h-10 rounded-full bg-background border border-border group-hover:border-primary overflow-hidden shrink-0 flex items-center justify-center transition">
                              {c.foto_url ? (
                                <img src={c.foto_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-xs text-muted-foreground group-hover:text-primary font-bold">
                                  {c.nome ? c.nome.charAt(0).toUpperCase() : 'C'}
                                </span>
                              )}
                            </div>
                            <div>
                              <h5 className="font-sans font-bold text-foreground text-sm group-hover:text-primary transition flex items-center gap-1.5">
                                {c.nome}
                                {vipEntry && (
                                  <Badge
                                    className={`text-xs uppercase tracking-wider font-bold ${
                                      vipEntry.renovado
                                        ? planBadgeClass(vipEntry.subscription.plan || '')
                                        : 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40'
                                    }`}
                                  >
                                    {vipEntry.renovado ? planLabel(vipEntry.subscription.plan || '') : `${planLabel(vipEntry.subscription.plan || '')} vencido`}
                                  </Badge>
                                )}
                                {/* Cliente com login por telefone não recebe e-mail do Stripe
                                    avisando cartão recusado. Esta tarja é o único aviso que
                                    o barbeiro tem de mensalidade perdida. */}
                                {vipEntry?.subscription.pendencia && (
                                  <Badge className="text-xs uppercase tracking-wider font-bold bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-900/40">
                                    Pagamento falhou
                                  </Badge>
                                )}
                              </h5>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                                {emailEDeTelefone(c.email) ? c.telefone : (c.email || 'Sem e-mail')}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs bg-background text-primary border border-border px-2 py-0.5 rounded-sm uppercase tracking-[0.05em]">
                            Cadastro: {c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}
                          </span>
                        </div>

                        <div className="text-xs text-muted-foreground space-y-1 pl-1 border-l-2 border-border">
                          <p className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">WhatsApp:</span>
                            <a
                              href={getWhatsAppLink(c.telefone)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                            >
                              <FaWhatsapp size={12} /> {c.telefone}
                            </a>
                          </p>
                          {/* E-mail sintético (login por telefone) não é mostrado:
                              é identificador interno, não um contato do cliente. */}
                          {c.email && !emailEDeTelefone(c.email) && (
                            <p className="flex items-center gap-1.5">
                              <span className="text-muted-foreground">E-mail:</span>
                              <span className="text-muted-foreground">{c.email}</span>
                            </p>
                          )}
                          {emailEDeTelefone(c.email) && (
                            <p className="flex items-center gap-1.5">
                              <span className="text-muted-foreground">Acesso ao app:</span>
                              <span className="text-muted-foreground">entra pelo telefone</span>
                            </p>
                          )}
                        </div>

                        {c.observacoes && (
                          <div className="text-xs text-muted-foreground bg-muted border border-border p-2.5 rounded-sm whitespace-pre-line leading-relaxed">
                            "{c.observacoes}"
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-2">
                          {PLAN_TIERS.map(tier => (
                            <Button
                              key={tier.key}
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={gerandoLink}
                              onClick={() => handleGerarLinkPagamento(c, tier.key)}
                            >
                              Cobrar {tier.label}
                            </Button>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRedefinirSenhaCliente(c)}
                          >
                            Redefinir senha
                          </Button>
                        </div>

                        {linkPagamento?.clienteId === c.id && (
                          <div className="space-y-2 bg-muted border border-border p-2.5 rounded-sm">
                            <p className="text-[10px] text-muted-foreground break-all">{linkPagamento.url}</p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(linkPagamento.url);
                                  setSuccessMsg('Link copiado.');
                                }}
                              >
                                Copiar link
                              </Button>
                              <a
                                href={`${getWhatsAppLink(c.telefone)}?text=${encodeURIComponent(
                                  `Olá ${c.nome}! Segue o link para ativar seu plano: ${linkPagamento.url}`
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Button type="button" size="sm" variant="outline">
                                  Mandar no WhatsApp
                                </Button>
                              </a>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            handleEditClientSelect(c);
                            const formAnchor = document.getElementById('client-form-anchor');
                            if (formAnchor) {
                              formAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }}
                          className="bg-background hover:bg-primary text-muted-foreground hover:text-black px-3 py-1 border border-border hover:border-transparent rounded-sm text-xs font-bold transition cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleClientActive(c)}
                          className="bg-background hover:bg-accent text-muted-foreground hover:text-orange-400 px-2.5 py-1 border border-border rounded-sm text-xs font-bold transition cursor-pointer"
                        >
                          Arquivar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClient(c)}
                          className="bg-background hover:bg-red-100 dark:bg-red-950/40 text-muted-foreground hover:text-red-600 dark:text-red-400 px-2.5 py-1 border border-border hover:border-red-200 dark:border-red-900/30 rounded-sm text-xs font-bold transition cursor-pointer"
                        >
                          Deletar
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}


          {/* TAB 6: FINANCE CRUD & HISTORY */}
          {activeTab === 'financeiro' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-normal text-2xl text-foreground tracking-tight">Fluxo de Caixa</h2>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="text-muted-foreground hover:text-primary hover:border-primary/50 border border-border bg-card px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-sm"
                  >
                    <Settings className="w-4 h-4" /> Categorias
                  </button>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowFinanceForm(true);
                      setTimeout(() => {
                        const el = document.getElementById('finance-valor') as HTMLInputElement;
                        if (el) el.focus();
                      }, 100);
                    }}
                    className="font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300"
                  >
                    <Plus className="w-4 h-4" /> Registrar Movimentação
                  </Button>
                </div>
              </div>

              <FiltroBarbeiro
                profissionais={profissionais}
                valor={filtroProfissional}
                onChange={setFiltroProfissional}
                incluirCasa
              />

              {/* Modal Popup de Lançamento Financeiro Rápido */}
              <AnimatePresence>
                {showFinanceForm && (
                  <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
                    onClick={() => setShowFinanceForm(false)}
                  >
                    <div 
                      className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden text-foreground space-y-5 p-6"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Modal Header */}
                      <div className="flex items-center justify-between border-b border-border pb-4">
                        <div>
                          <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                            <Plus className="w-5 h-5 text-primary" /> Registrar Movimentação Financeira
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Digite o valor e os detalhes do lançamento para atualizar o saldo instantaneamente
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowFinanceForm(false)}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition cursor-pointer"
                          aria-label="Fechar"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Modal Form */}
                      <form onSubmit={handleSaveFinanceLaunch} className="space-y-5">
                        {/* Tipo toggle — Entrada vs Saída */}
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            id="finance-type-entrada"
                            type="button"
                            onClick={() => {
                              setNewLaunch({ ...newLaunch, tipo: 'entrada' });
                              setTimeout(() => (document.getElementById('finance-valor') as HTMLInputElement)?.focus(), 50);
                            }}
                            className={`py-3 rounded-xl font-bold text-sm tracking-wide border-2 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                              newLaunch.tipo === 'entrada'
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-900/30'
                                : 'bg-background border-border text-muted-foreground hover:border-emerald-600 hover:text-emerald-500'
                            }`}
                          >
                            <TrendingUp className="w-4 h-4" /> ENTRADA (Receita)
                          </button>
                          <button
                            id="finance-type-saida"
                            type="button"
                            onClick={() => {
                              setNewLaunch({ ...newLaunch, tipo: 'saida' });
                              setTimeout(() => (document.getElementById('finance-valor') as HTMLInputElement)?.focus(), 50);
                            }}
                            className={`py-3 rounded-xl font-bold text-sm tracking-wide border-2 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                              newLaunch.tipo === 'saida'
                                ? 'bg-red-600 border-red-600 text-white shadow-md shadow-red-900/30'
                                : 'bg-background border-border text-muted-foreground hover:border-red-500 hover:text-red-500'
                            }`}
                          >
                            <TrendingDown className="w-4 h-4" /> SAÍDA (Despesa)
                          </button>
                        </div>

                        {/* Valor em destaque absoluto - autoFocus */}
                        <div className="space-y-1.5">
                          <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Valor (R$)</Label>
                          <div className="relative">
                            <span
                              className={`absolute left-4 top-1/2 -translate-y-1/2 font-extrabold text-3xl select-none pointer-events-none ${
                                newLaunch.tipo === 'entrada' ? 'text-emerald-500' : 'text-red-500'
                              }`}
                            >
                              R$
                            </span>
                            <input
                              id="finance-valor"
                              type="text"
                              inputMode="decimal"
                              required
                              autoFocus
                              value={newLaunch.valor}
                              onChange={(e) => {
                                let inputVal = e.target.value;
                                inputVal = inputVal.replace('.', ',');
                                const parts = inputVal.split(',');
                                if (parts.length > 2) return;
                                const integerPart = parts[0].replace(/[^0-9]/g, '');
                                let decimalPart = parts[1] !== undefined ? parts[1].replace(/[^0-9]/g, '').slice(0, 2) : undefined;
                                
                                if (decimalPart !== undefined) {
                                  setNewLaunch({ ...newLaunch, valor: `${integerPart},${decimalPart}` });
                                } else {
                                  setNewLaunch({ ...newLaunch, valor: integerPart });
                                }
                              }}
                              onBlur={() => {
                                if (!newLaunch.valor) return;
                                if (!newLaunch.valor.includes(',')) {
                                  setNewLaunch({ ...newLaunch, valor: `${newLaunch.valor},00` });
                                } else {
                                  const [int, dec] = newLaunch.valor.split(',');
                                  const paddedDec = (dec || '').padEnd(2, '0');
                                  setNewLaunch({ ...newLaunch, valor: `${int || '0'},${paddedDec}` });
                                }
                              }}
                              placeholder="0,00"
                              className="w-full pl-16 pr-4 py-4 text-3xl font-extrabold rounded-xl border border-border bg-background outline-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-muted-foreground/30 text-foreground"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Descrição (opcional)</Label>
                            <Input
                              type="text"
                              value={newLaunch.descricao}
                              onChange={(e) => setNewLaunch({ ...newLaunch, descricao: e.target.value })}
                              placeholder="Ex: Compra de golas higiênicas"
                              className="rounded-xl"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Categoria</Label>
                            <Select value={newLaunch.categoria} onValueChange={(v) => v && setNewLaunch({ ...newLaunch, categoria: v as string })}>
                              <SelectTrigger className="w-full rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {categoriasFinanceiras.filter(c => c.tipo === newLaunch.tipo).map(cat => (
                                  <SelectItem key={cat.id} value={cat.nome}>{cat.nome}</SelectItem>
                                ))}
                                {categoriasFinanceiras.filter(c => c.tipo === newLaunch.tipo).length === 0 && (
                                  <SelectItem value="Serviços">Serviços</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Forma de Pagamento</Label>
                            <Select value={newLaunch.forma_pagamento} onValueChange={(v) => v && setNewLaunch({ ...newLaunch, forma_pagamento: v as any })}>
                              <SelectTrigger className="w-full rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                <SelectItem value="pix">Pix</SelectItem>
                                <SelectItem value="cartao">Cartão de débito/crédito</SelectItem>
                                <SelectItem value="outro">Outro método</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Data</Label>
                            <Input
                              type="date"
                              required
                              value={newLaunch.data}
                              onChange={(e) => setNewLaunch({ ...newLaunch, data: e.target.value })}
                              className="rounded-xl"
                            />
                          </div>
                        </div>

                        {/* Barbeiro receptor / pagador */}
                        {profissionais.filter(p => p.ativo).length > 1 && (
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">
                              {newLaunch.tipo === 'entrada' ? 'Venda de qual barbeiro?' : 'Despesa de qual barbeiro?'}
                            </Label>
                            <Select
                              value={newLaunch.profissional_id || 'casa'}
                              onValueChange={(v) => setNewLaunch({ ...newLaunch, profissional_id: v === 'casa' ? '' : (v as string) })}
                            >
                              <SelectTrigger className="w-full rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="casa">Barbearia (Sem barbeiro específico)</SelectItem>
                                {profissionais.filter(p => p.ativo).map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="pt-2 border-t border-border flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowFinanceForm(false)}
                            className="w-1/3 py-3 rounded-xl text-xs uppercase font-bold cursor-pointer"
                          >
                            Cancelar
                          </Button>
                          <button
                            type="submit"
                            disabled={submitting}
                            className={`w-2/3 py-3 rounded-xl font-bold text-sm tracking-wide text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md ${
                              newLaunch.tipo === 'entrada'
                                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30'
                                : 'bg-red-600 hover:bg-red-500 shadow-red-900/30'
                            }`}
                          >
                            {submitting ? 'Salvando...' : newLaunch.tipo === 'entrada' ? '↑ Confirmar Entrada' : '↓ Confirmar Saída'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </AnimatePresence>

              {/* Logs history complete */}
              <div className="space-y-4">

                {/* Search Filters Row */}
                <div className="bg-background border border-border p-4 rounded-sm grid grid-cols-1 sm:grid-cols-3 gap-4 items-end text-xs text-muted-foreground shadow-inner">
                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold block">De (Data Inicial):</span>
                    <input
                      type="date"
                      value={filterFinanceStartDate}
                      onChange={(e) => { setFilterFinanceStartDate(e.target.value); setFinanceCurrentPage(1); }}
                      className="w-full bg-background border border-border text-foreground px-3 py-1.5 rounded-sm focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold block">Até (Data Final):</span>
                    <input
                      type="date"
                      value={filterFinanceEndDate}
                      onChange={(e) => { setFilterFinanceEndDate(e.target.value); setFinanceCurrentPage(1); }}
                      className="w-full bg-background border border-border text-foreground px-3 py-1.5 rounded-sm focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold block">Filtro de Categoria:</span>
                    <select
                      value={filterCategory}
                      onChange={(e) => { setFilterCategory(e.target.value); setFinanceCurrentPage(1); }}
                      className="w-full bg-background border border-border text-foreground px-3 py-1.5 rounded-sm focus:border-primary focus:outline-none"
                    >
                      <option value="all">Todas as Categorias</option>
                      {Array.from(new Set(categoriasFinanceiras.map(c => c.nome))).map(catName => (
                        <option key={catName} value={catName}>{catName}</option>
                      ))}
                    </select>
                  </div>

                  {(filterFinanceStartDate || filterFinanceEndDate || filterCategory !== 'all') && (
                    <div className="sm:col-span-3 flex justify-end">
                      <button
                        onClick={() => {
                          setFilterFinanceStartDate('');
                          setFilterFinanceEndDate('');
                          setFilterCategory('all');
                          setFinanceCurrentPage(1);
                        }}
                        className="text-xs text-red-600 dark:text-red-400 hover:dark:text-red-300 font-bold uppercase tracking-wider cursor-pointer transition"
                      >
                        Limpar Filtros de Pesquisa
                      </button>
                    </div>
                  )}
                </div>
 
                <div className="overflow-x-auto rounded-sm border border-border bg-card">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-background border-b border-border text-muted-foreground font-semibold text-xs uppercase tracking-[0.1em]">
                        <th className="p-3">Data</th>
                        <th className="p-3">Natureza</th>
                        <th className="p-3">Descrição Operacional</th>
                        <th className="p-3">Marcador</th>
                        <th className="p-3">Método</th>
                        <th className="p-3 text-right">Valor final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-850 text-muted-foreground">
                      {(() => {
                        const filtered = financeiro.filter(f => {
                          if (filterCategory !== 'all' && f.categoria !== filterCategory) return false;
                          if (filterFinanceStartDate && f.data < filterFinanceStartDate) return false;
                          if (filterFinanceEndDate && f.data > filterFinanceEndDate) return false;
                          return true;
                        });
                        const totalLogs = filtered.length;
                        const totalPages = Math.ceil(totalLogs / logsPerPage) || 1;
                        const activePage = Math.min(financeCurrentPage, totalPages);
                        const indexOfLastLog = activePage * logsPerPage;
                        const indexOfFirstLog = indexOfLastLog - logsPerPage;
                        const currentLogs = filtered.slice(indexOfFirstLog, indexOfLastLog);

                        if (currentLogs.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="p-12 text-center text-muted-foreground text-xs uppercase tracking-wider">
                                Nenhuma movimentação financeira encontrada para os critérios de pesquisa
                              </td>
                            </tr>
                          );
                        }

                        return currentLogs.map(f => (
                          <tr key={f.id} className={`transition duration-150 ${f.excluido ? 'opacity-30 line-through select-none bg-card/10' : 'hover:bg-accent/30'}`}>
                            <td className="p-3 text-xs">{f.data.split('-').reverse().join('/')}</td>
                            <td className="p-3 flex items-center gap-2">
                              <span className={`inline-block px-2 py-0.5 rounded-sm text-xs font-bold uppercase tracking-wider ${
                                f.tipo === 'entrada' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                              }`}>
                                {f.tipo === 'entrada' ? 'Entrada' : 'Despesa'}
                              </span>
                              {f.excluido && (
                                <span className="bg-red-100 dark:bg-red-950/50 text-red-500 border border-red-200 dark:border-red-900/30 px-1.5 py-0.5 rounded-sm text-xs uppercase tracking-wider font-extrabold">
                                  Excluído (Histórico)
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-medium text-foreground">
                              {f.excluido ? `[Registro Excluído] ${f.descricao}` : f.descricao}
                            </td>
                            <td className="p-3 text-muted-foreground text-xs">{f.categoria}</td>
                            <td className="p-3 text-xs uppercase text-muted-foreground">{f.forma_pagamento}</td>
                            <td className={`p-3 text-right font-bold ${
                              f.tipo === 'entrada' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                              {f.tipo === 'entrada' ? '+' : '-'}{formatBRL(f.valor)}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls block */}
                {(() => {
                  const filtered = financeiro.filter(f => {
                    if (filterCategory !== 'all' && f.categoria !== filterCategory) return false;
                    if (filterFinanceStartDate && f.data < filterFinanceStartDate) return false;
                    if (filterFinanceEndDate && f.data > filterFinanceEndDate) return false;
                    return true;
                  });
                  const totalLogs = filtered.length;
                  const totalPages = Math.ceil(totalLogs / logsPerPage) || 1;
                  const activePage = Math.min(financeCurrentPage, totalPages);
                  const indexOfLastLog = activePage * logsPerPage;
                  const indexOfFirstLog = indexOfLastLog - logsPerPage;

                  if (totalPages <= 1) return null;

                  return (
                    <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground gap-4">
                      <div>
                        Mostrando <span className="font-bold text-muted-foreground">{indexOfFirstLog + 1}</span> a{' '}
                        <span className="font-bold text-muted-foreground">{Math.min(indexOfLastLog, totalLogs)}</span> de{' '}
                        <span className="font-bold text-muted-foreground">{totalLogs}</span> transações
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={activePage === 1}
                          onClick={() => setFinanceCurrentPage(p => Math.max(p - 1, 1))}
                          className="px-3 py-1.5 bg-card border border-border rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 transition cursor-pointer"
                        >
                          &larr; Anterior
                        </button>
                        <span className="text-muted-foreground font-sans text-xs">
                          Página <span className="font-bold text-primary">{activePage}</span> de <span>{totalPages}</span>
                        </span>
                        <button
                          type="button"
                          disabled={activePage === totalPages}
                          onClick={() => setFinanceCurrentPage(p => Math.min(p + 1, totalPages))}
                          className="px-3 py-1.5 bg-card border border-border rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 transition cursor-pointer"
                        >
                          Próxima &rarr;
                        </button>
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>
          )}


          {/* TAB 7: CONFIGS - SHIFTS AND BLOCKS */}
          {activeTab === 'configuracoes' && configuracoes && (
            <div className="space-y-8">
              <div>
                <h2 className="font-normal text-2xl text-foreground tracking-tight">Configuração de Horários & Expediente</h2>
                <p className="text-muted-foreground text-xs mt-1">Ajuste expediente diário, configure horários de almoço, impeça marcações em feriados ou janelas privadas</p>
              </div>

              {/* Seleção de Profissional (se houver equipe) */}
              {profissionais.length > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-card border border-border rounded-xl shadow-sm">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Escala por Profissional</h4>
                    <p className="text-xs text-muted-foreground">Escolha qual barbeiro deseja visualizar e editar o horário de funcionamento:</p>
                  </div>
                  <select
                    value={selectedConfigProfissionalId}
                    onChange={(e) => setSelectedConfigProfissionalId(e.target.value)}
                    className="bg-background border border-border rounded-lg px-3 py-2 text-xs font-bold text-foreground focus:border-primary focus:outline-none min-w-[200px]"
                  >
                    <option value="all">Todos os Barbeiros (Geral)</option>
                    {profissionais.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} {p.ativo ? '' : '(Inativo)'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Card - Definir Horário Geral em Lote */}
              <div className="p-5 bg-card border border-border rounded-xl space-y-4 shadow-sm">
                <div className="space-y-1">
                  <h4 className="text-sm tracking-wide text-foreground font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Definir Horário Padrão (Abertura, Fechamento e Almoço)
                  </h4>
                  <p className="text-muted-foreground text-xs text-left">
                    Configure os horários de funcionamento personalizados (ex: 08:00 às 20:00) e aplique instantaneamente a todos os dias da semana:
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="space-y-1 text-left">
                    <span className="text-xs text-muted-foreground block font-bold uppercase tracking-wider">Abertura:</span>
                    <input 
                      type="time" 
                      value={batchStart}
                      onChange={(e) => setBatchStart(e.target.value)}
                      className="bg-background border border-border p-2 px-3 rounded-lg w-full text-xs font-bold text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1 text-left">
                    <span className="text-xs text-muted-foreground block font-bold uppercase tracking-wider">Fechamento:</span>
                    <input 
                      type="time" 
                      value={batchEnd}
                      onChange={(e) => setBatchEnd(e.target.value)}
                      className="bg-background border border-border p-2 px-3 rounded-lg w-full text-xs font-bold text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1 text-left">
                    <span className="text-xs text-muted-foreground block font-bold uppercase tracking-wider">Início Almoço:</span>
                    <input 
                      type="time" 
                      value={defaultIntervalStart}
                      onChange={(e) => setDefaultIntervalStart(e.target.value)}
                      className="bg-background border border-border p-2 px-3 rounded-lg w-full text-xs font-bold text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1 text-left">
                    <span className="text-xs text-muted-foreground block font-bold uppercase tracking-wider">Fim Almoço:</span>
                    <input 
                      type="time" 
                      value={defaultIntervalEnd}
                      onChange={(e) => setDefaultIntervalEnd(e.target.value)}
                      className="bg-background border border-border p-2 px-3 rounded-lg w-full text-xs font-bold text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleApplyDefaultInterval}
                    className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-xl shadow-md transition cursor-pointer text-gold-glow"
                  >
                    Aplicar em Todos os Dias da Semana
                  </button>
                </div>
              </div>

              {/* Expedientes grid configuration */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-sm tracking-wide text-foreground font-semibold">
                    Escala de Funcionamento Semanal (Personalizada por Dia)
                  </h4>
                  {configuracoes.expedientes.find(e => e.dia_semana === 1) && (
                    <button
                      type="button"
                      onClick={() => {
                        const seg = configuracoes.expedientes.find(e => e.dia_semana === 1);
                        if (!seg) return;
                        const uteis = configuracoes.expedientes.filter(e => e.dia_semana >= 1 && e.dia_semana <= 5);
                        uteis.forEach(u => {
                          handleUpdateExpediente(u.id, {
                            hora_inicio: seg.hora_inicio,
                            hora_fim: seg.hora_fim,
                            intervalo_inicio: seg.intervalo_inicio,
                            intervalo_fim: seg.intervalo_fim,
                            ativo: seg.ativo
                          });
                        });
                      }}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Replicar Segunda (Seg-Sex)
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 gap-3.5">
                  {configuracoes.expedientes
                    .filter(ex => selectedConfigProfissionalId === 'all' || !ex.profissional_id || ex.profissional_id === selectedConfigProfissionalId)
                    .map((ex) => {
                      const prof = profissionais.find(p => p.id === ex.profissional_id);
                      return (
                        <div 
                          key={ex.id} 
                          className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-sm ${
                            ex.ativo ? 'border-border bg-card' : 'border-border/60 bg-muted/30 opacity-70'
                          }`}
                        >
                          {/* Name and active switch toggle button */}
                          <div className="flex justify-between items-center md:block min-w-[140px]">
                            <div>
                              <span className="font-sans font-bold text-foreground text-sm block">
                                {getDayName(ex.dia_semana)}
                              </span>
                              {prof && selectedConfigProfissionalId === 'all' && (
                                <span className="text-[10px] text-primary font-bold block mt-0.5">
                                  {prof.nome}
                                </span>
                              )}
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => handleUpdateExpediente(ex.id, { ativo: !ex.ativo })}
                              className={`mt-2 p-1.5 px-3 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition cursor-pointer ${
                                ex.ativo 
                                  ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20' 
                                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {ex.ativo ? 'Aberto (Ativo)' : 'Fechado (Folga)'}
                            </button>
                          </div>

                          {/* Config shifts values form with native time inputs */}
                          {ex.ativo && (
                            <div className="flex-1 max-w-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              <div className="space-y-1">
                                <span className="text-[11px] text-muted-foreground block font-bold uppercase tracking-wider">Abertura:</span>
                                <input 
                                  type="time" 
                                  defaultValue={ex.hora_inicio} 
                                  onBlur={(e) => {
                                    if (e.target.value && e.target.value !== ex.hora_inicio) {
                                      handleUpdateExpediente(ex.id, { hora_inicio: e.target.value });
                                    }
                                  }}
                                  className="bg-background border border-border p-2 px-2.5 rounded-lg w-full font-bold text-foreground focus:border-primary focus:outline-none text-xs"
                                />
                              </div>

                              <div className="space-y-1">
                                <span className="text-[11px] text-muted-foreground block font-bold uppercase tracking-wider">Fechamento:</span>
                                <input 
                                  type="time" 
                                  defaultValue={ex.hora_fim} 
                                  onBlur={(e) => {
                                    if (e.target.value && e.target.value !== ex.hora_fim) {
                                      handleUpdateExpediente(ex.id, { hora_fim: e.target.value });
                                    }
                                  }}
                                  className="bg-background border border-border p-2 px-2.5 rounded-lg w-full font-bold text-foreground focus:border-primary focus:outline-none text-xs"
                                />
                              </div>

                              <div className="space-y-1">
                                <span className="text-[11px] text-muted-foreground block font-bold uppercase tracking-wider">Almoço Início:</span>
                                <input 
                                  type="time" 
                                  defaultValue={ex.intervalo_inicio || ''} 
                                  onBlur={(e) => {
                                    const val = e.target.value || null;
                                    if (val !== ex.intervalo_inicio) {
                                      handleUpdateExpediente(ex.id, { intervalo_inicio: val });
                                    }
                                  }}
                                  className="bg-background border border-border p-2 px-2.5 rounded-lg w-full font-bold text-foreground focus:border-primary focus:outline-none text-xs"
                                />
                              </div>

                              <div className="space-y-1">
                                <span className="text-[11px] text-muted-foreground block font-bold uppercase tracking-wider">Almoço Fim:</span>
                                <input 
                                  type="time" 
                                  defaultValue={ex.intervalo_fim || ''} 
                                  onBlur={(e) => {
                                    const val = e.target.value || null;
                                    if (val !== ex.intervalo_fim) {
                                      handleUpdateExpediente(ex.id, { intervalo_fim: val });
                                    }
                                  }}
                                  className="bg-background border border-border p-2 px-2.5 rounded-lg w-full font-bold text-foreground focus:border-primary focus:outline-none text-xs"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>


              {/* Block day or hour form */}
              <div className="space-y-6 pt-6 border-t border-border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  
                  {/* Block Creator Form */}
                  <div className="space-y-4">
                    <h4 className="text-sm tracking-wide text-foreground font-semibold">Novo Bloqueio de Grade</h4>
                     
                    <form onSubmit={handleSaveBlock} className="bg-card p-5 border border-border rounded-sm text-xs space-y-3.5">
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Qual Data de bloqueio?</label>
                        <input
                          type="date"
                          required
                          value={newBlock.data}
                          onChange={(e) => setNewBlock({ ...newBlock, data: e.target.value })}
                          className="w-full bg-background border border-border rounded-sm px-3 py-2 text-muted-foreground focus:text-foreground focus:border-primary"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Hora Início:</label>
                          <input
                            type="text"
                            placeholder="Ex: 14:00"
                            value={newBlock.hora_inicio}
                            onChange={(e) => setNewBlock({ ...newBlock, hora_inicio: e.target.value })}
                            className="w-full bg-background border border-border rounded-sm p-2 text-center text-foreground focus:border-primary"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Hora Fim:</label>
                          <input
                            type="text"
                            placeholder="Ex: 17:00"
                            value={newBlock.hora_fim}
                            onChange={(e) => setNewBlock({ ...newBlock, hora_fim: e.target.value })}
                            className="w-full bg-background border border-border rounded-sm p-2 text-center text-foreground focus:border-primary"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Motivo do bloqueio:</label>
                        <input
                          type="text"
                          required
                          value={newBlock.motivo}
                          onChange={(e) => setNewBlock({ ...newBlock, motivo: e.target.value })}
                          placeholder="Ex: Feriado municipal, viagem ou folga pessoal"
                          className="w-full bg-background border border-border rounded-sm p-2 text-foreground placeholder:text-muted-foreground focus:border-primary"
                        />
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full bg-primary border border-primary text-black font-semibold uppercase tracking-wider py-2.5 rounded-sm transition font-bold text-xs cursor-pointer"
                        >
                          Confirmar Bloqueio
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Block list active details */}
                  <div className="space-y-4">
                    <h4 className="text-sm tracking-wide text-foreground font-semibold">Bloqueios Cadastrados</h4>
                    
                    {configuracoes.bloqueios.length === 0 ? (
                      <div className="p-8 text-center bg-card rounded-sm border border-border">
                        <p className="text-muted-foreground uppercase tracking-wider text-xs">Nenhum bloqueio programado na agenda.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                        {configuracoes.bloqueios.map(b => (
                          <div key={b.id} className="p-3 border border-border rounded-sm bg-card flex justify-between items-center gap-3">
                            <div>
                              <p className="font-bold text-foreground text-xs">
                                {b.data.split('-').reverse().join('/')} {b.hora_inicio && b.hora_fim ? `• ${b.hora_inicio}h às ${b.hora_fim}h` : '• Integral'}
                              </p>
                              <p className="text-primary font-medium text-[10.5px] mt-0.5">Motivo: {b.motivo}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteBlock(b.id)}
                              className="text-muted-foreground hover:text-red-600 dark:text-red-400 transition"
                              title="Remover Bloqueio"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Modal for Editing Financial Transaction */}
      {editingFinanceId && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-card border border-border p-6 rounded-md w-full max-w-md shadow-2xl relative space-y-4">
            <h3 className="text-lg tracking-wide text-primary font-bold">Editar Movimentação Financeira</h3>
            
            <form onSubmit={handleSaveEditFinance} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-muted-foreground block">Tipo</label>
                <select
                  value={editFinanceForm.tipo}
                  onChange={(e) => setEditFinanceForm({...editFinanceForm, tipo: e.target.value as any})}
                  className="w-full bg-card border border-border text-foreground px-3 py-2 rounded-sm focus:border-primary focus:outline-none"
                >
                  <option value="entrada">Entrada (Receita)</option>
                  <option value="saida">Saída (Despesa)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground block">Data</label>
                <input
                  type="date"
                  required
                  value={editFinanceForm.data}
                  onChange={(e) => setEditFinanceForm({...editFinanceForm, data: e.target.value})}
                  className="w-full bg-card border border-border text-foreground px-3 py-2 rounded-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground block">Descrição (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Aluguel da sala"
                  value={editFinanceForm.descricao}
                  onChange={(e) => setEditFinanceForm({...editFinanceForm, descricao: e.target.value})}
                  className="w-full bg-card border border-border text-foreground px-3 py-2 rounded-sm font-sans focus:border-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground block">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  placeholder="0.00"
                  value={editFinanceForm.valor}
                  onChange={(e) => setEditFinanceForm({...editFinanceForm, valor: e.target.value})}
                  className="w-full bg-card border border-border text-foreground px-3 py-2 rounded-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground block">Categoria</label>
                <select
                  value={editFinanceForm.categoria}
                  onChange={(e) => setEditFinanceForm({...editFinanceForm, categoria: e.target.value})}
                  className="w-full bg-card border border-border text-foreground px-3 py-2 rounded-sm focus:border-primary focus:outline-none bg-background"
                >
                  {categoriasFinanceiras.filter(c => c.tipo === editFinanceForm.tipo).map(cat => (
                    <option key={cat.id} value={cat.nome}>{cat.nome}</option>
                  ))}
                  {categoriasFinanceiras.filter(c => c.tipo === editFinanceForm.tipo).length === 0 && (
                    <option value="Serviços">Serviços</option>
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground block">Forma de Pagamento</label>
                <select
                  value={editFinanceForm.forma_pagamento}
                  onChange={(e) => setEditFinanceForm({...editFinanceForm, forma_pagamento: e.target.value as any})}
                  className="w-full bg-card border border-border text-foreground px-3 py-2 rounded-sm focus:border-primary focus:outline-none"
                >
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao">Cartão de Crédito/Débito</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingFinanceId(null)}
                  className="px-4 py-2 bg-card border border-border text-muted-foreground rounded-sm hover:bg-muted transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-sm hover:bg-primary/80 transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pop-up Modal for Financial Categories Management */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[101] flex items-center justify-center p-4">
          <div className="bg-card border border-border p-6 rounded-md w-full max-w-lg shadow-2xl relative space-y-5 animate-fade-in text-foreground">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-lg tracking-wide text-primary font-bold">Ajustes de Categorias Financeiras</h3>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-muted-foreground hover:text-muted-foreground font-bold transition text-sm cursor-pointer"
              >
                ✕ Fechar
              </button>
            </div>

            {/* Form to create/add a category */}
            <form onSubmit={handleCreateCategory} className="bg-background p-4 border border-border rounded-sm space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Nova Categoria</h4>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-6 space-y-1">
                  <span className="text-xs text-muted-foreground block">Nome da Categoria:</span>
                  <input
                    type="text"
                    required
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Ex: Aluguel da Sala, Café, Venda de Pomada"
                    className="w-full bg-card border border-border text-xs px-3 py-2 text-foreground rounded-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-4 space-y-1">
                  <span className="text-xs text-muted-foreground block">Natureza:</span>
                  <select
                    value={newCategoryType}
                    onChange={(e) => setNewCategoryType(e.target.value as any)}
                    className="w-full bg-card border border-border text-xs px-2 py-2 text-foreground rounded-sm focus:border-primary focus:outline-none"
                  >
                    <option value="entrada">Entrada (Ganhos)</option>
                    <option value="saida">Saída (Despesas)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-primary hover:bg-primary/80 text-black font-bold text-xs py-2 rounded-sm transition cursor-pointer"
                  >
                    Criar
                  </button>
                </div>
              </div>
            </form>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Categorias Cadastradas</h4>
              
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {categoriasFinanceiras.map(c => (
                  <div key={c.id} className="p-2 border border-border bg-card rounded-sm flex items-center justify-between gap-3">
                    {editingCategoryId === c.id ? (
                      <form onSubmit={handleUpdateCategory} className="flex flex-1 items-center gap-2">
                        <input
                          type="text"
                          required
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          className="flex-1 bg-card border border-border p-1 rounded-sm text-foreground text-xs"
                        />
                        <select
                          value={editingCategoryType}
                          onChange={(e) => setEditingCategoryType(e.target.value as any)}
                          className="bg-card border border-border p-1 rounded-sm text-foreground text-xs"
                        >
                          <option value="entrada">Entrada</option>
                          <option value="saida">Saída</option>
                        </select>
                        <button type="submit" className="text-emerald-600 dark:text-emerald-400 hover:dark:text-emerald-300 font-bold px-1 transition text-xs">Salvar</button>
                        <button type="button" onClick={() => setEditingCategoryId(null)} className="text-muted-foreground hover:text-muted-foreground px-1 text-xs">X</button>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-2, h-2 w-2 rounded-full ${c.tipo === 'entrada' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <span className="font-bold text-foreground">{c.nome}</span>
                          <span className={`text-xs px-1 rounded-sm uppercase tracking-wider ${
                            c.tipo === 'entrada' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30' : 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30'
                          }`}>
                            {c.tipo}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategoryId(c.id);
                              setEditingCategoryName(c.nome);
                              setEditingCategoryType(c.tipo);
                            }}
                            className="text-muted-foreground hover:text-primary transition text-xs"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(c.id)}
                            className="text-red-600 dark:text-red-400 hover:dark:text-red-300 transition text-xs"
                          >
                            Excluir
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 bg-card text-muted-foreground border border-border rounded-sm hover:bg-accent hover:text-foreground transition text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Plan Modal */}
      <AnimatePresence>
        {isPlanModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPlanModalOpen(false)}
              className="fixed inset-0 bg-black/85 backdrop-blur-sm"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative bg-card border border-border rounded-sm w-full max-w-md p-6 overflow-hidden shadow-2xl z-10"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-sm bg-primary/10 flex items-center justify-center text-primary">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-normal text-base text-foreground tracking-wide">Status da Assinatura</h3>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider -mt-0.5">Plano Ativo: Profissional 30 Dias</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="p-1.5 text-muted-foreground hover:text-foreground border border-border hover:bg-accent rounded-sm transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="space-y-6">
                {/* Giant Progress representation */}
                <div className="bg-background border border-border p-4 rounded-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground">Tempo Decorrido</span>
                    <span className="text-sm font-bold text-primary">{planStats.elapsedDays} de {planStats.totalDays} dias</span>
                  </div>

                  {/* Main Progress Bar */}
                  <div className="w-full bg-card h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-primary/60 to-primary h-full rounded-full transition-all duration-500"
                      style={{ width: `${planStats.percent}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>Início do Ciclo: {planStats.cycleStart}</span>
                    <span>Próximo Fechamento: {planStats.cycleEnd}</span>
                  </div>
                </div>

                {/* Progress Detail Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background border border-border/60 p-3 rounded-sm space-y-1">
                    <span className="text-xs uppercase text-muted-foreground font-bold block">Uso Consumido</span>
                    <span className="text-base font-bold text-primary">{planStats.percent}%</span>
                    <span className="text-xs text-muted-foreground block ">{planStats.elapsedDays} dias decorridos</span>
                  </div>

                  <div className="bg-background border border-border/60 p-3 rounded-sm space-y-1">
                    <span className="text-xs uppercase text-muted-foreground font-bold block">Dias Restantes</span>
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{planStats.remainingDays} d</span>
                    <span className="text-xs text-muted-foreground block ">Até o fechamento</span>
                  </div>
                </div>

                {/* Feature checklist */}
                <div className="space-y-2.5 text-xs text-muted-foreground border-t border-border pt-5">
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider block mb-1">Recursos Ativos no seu Plano</span>
                  
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>Agenda Completa e Fichas Ilimitadas</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>Balanço e Fluxo de Caixa Avançados</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>Configuração Dinâmica de Escala & Horários</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>Controle de Estoque & Cosméticos à Venda</span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-8 pt-4 border-t border-border flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-4 py-2 bg-card hover:bg-accent border border-border hover:border-primary/40 text-muted-foreground rounded-sm text-xs font-bold transition uppercase tracking-wider cursor-pointer font-sans"
                >
                  Voltar ao Painel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AgendaDetalheModal
        agendamento={agendamentoDetalhe}
        profissionais={profissionais}
        servicos={servicos}
        onClose={() => setAgendamentoDetalhe(null)}
        onConcluir={(id) => handleUpdateBookingStatus(id, 'concluido')}
        onCancelar={(id) => handleUpdateBookingStatus(id, 'cancelado')}
      />

      <ManualBookingModal
        isOpen={isManualBookingModalOpen}
        onClose={() => setIsManualBookingModalOpen(false)}
        profissionais={profissionais}
        services={servicos}
        clientes={clientes}
        defaultProfissionalId={filtroProfissional}
        slotInicial={slotInicial}
        onBookingSuccess={() => {
          fetchAgendamentos();
          if (activeTab === 'dashboard') fetchDashboard();
        }}
      />
    </div>
  );
}
