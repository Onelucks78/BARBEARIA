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
  CheckCircle2
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { Sidebar, Header } from './Layout.tsx';
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
  ClienteSubscription
} from '../types.ts';
import type { Session } from '@supabase/supabase-js';
import { authedFetch } from '../lib/supabase.ts';

interface AdminLayoutProps {
  session: Session;
  onLogout: () => void;
}

export default function AdminLayout({ session, onLogout }: AdminLayoutProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'agenda' | 'servicos' | 'produtos' | 'planos' | 'clientes' | 'financeiro' | 'configuracoes'>('dashboard');
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
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form creation States
  const [newService, setNewService] = useState({ nome: '', descricao: '', preco: '', duracao_minutos: '45', imagem_url: '' });
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  const [newProduct, setNewProduct] = useState({ nome: '', descricao: '', preco: '', estoque: '10', imagem_url: '' });
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [newClient, setNewClient] = useState({ nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '' });
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  const [newLaunch, setNewLaunch] = useState({ tipo: 'entrada', descricao: '', valor: '', categoria: '', forma_pagamento: 'pix', data: '', produto_id: '' });
  const [editingFinanceId, setEditingFinanceId] = useState<string | null>(null);
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

  // Filters & Pagination for Fluxo de Caixa listing
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterFinanceStartDate, setFilterFinanceStartDate] = useState<string>('');
  const [filterFinanceEndDate, setFilterFinanceEndDate] = useState<string>('');
  const [financeCurrentPage, setFinanceCurrentPage] = useState(1);
  const logsPerPage = 40;

  // Initialize dates
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
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

    authedFetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => setDashboardStats(data))
      .catch(err => console.error('Dashboard:', err));
  };


  const fetchAgendamentos = () => {
    authedFetch('/api/admin/agendamentos')
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => setAgendamentos(data))
      .catch(err => console.error('Agendamentos:', err));
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
    authedFetch('/api/admin/financeiro')
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
  }, [activeTab, dashboardPeriod]);

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

      const res = await authedFetch(url, {
        method,
        body: newClient
      });

      if (!res.ok) throw new Error('Erro ao cuidar do cadastro de cliente.');
      setSuccessMsg(isEditing ? 'Ficha técnica do cliente atualizada.' : 'Cliente fidelizado com sucesso.');
      setNewClient({ nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '' });
      setEditingClientId(null);
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
      observacoes: c.observacoes || ''
    });
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
        produto_id: ''
      });
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
    if (!defaultIntervalStart || !defaultIntervalEnd) {
      setErrorMsg('Por favor, preencha o início e o fim do almoço.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await authedFetch('/api/admin/expedientes/intervalo-padrao', {
        method: 'POST',

        body: {
          intervalo_inicio: defaultIntervalStart,
          intervalo_fim: defaultIntervalEnd
        }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Não foi possível atualizar o intervalo padrão.');
      }
      setSuccessMsg('Intervalo de almoço padrão aplicado a todos os dias com sucesso!');
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

  // Filtered list of agenda
  const filteredAgendamentos = [...agendamentos]
    .filter(a => {
      const todayStr = new Date().toISOString().split('T')[0];
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
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-sm bg-primary rotate-45 flex items-center justify-center font-bold text-xs text-black">
                      <span className="-rotate-45">AI</span>
                    </div>
                    <div>
                      <span className="font-normal text-sm tracking-widest uppercase block text-primary">Escritório</span>
                      <span className="text-xs text-primary/70 uppercase block -mt-0.5">do Barbeiro</span>
                    </div>
                  </div>

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
        />

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
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="font-normal text-2xl text-foreground tracking-tight">Agenda de Compromissos</h2>
                  <p className="text-muted-foreground text-xs mt-1">Mude o status de agendamentos e consulte relatórios de clientes</p>
                </div>

                {/* Agenda Mode & Date Selector */}
                <div className="flex flex-wrap items-center gap-2 text-xs w-full md:w-auto">
                  <div className="flex bg-card p-1 border border-border rounded-sm font-semibold w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setAgendaFilterMode('upcoming')}
                      className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-sm transition text-center cursor-pointer ${
                        agendaFilterMode === 'upcoming' 
                          ? 'bg-primary text-primary-foreground shadow-md font-bold' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Hoje e Futuros
                    </button>
                    <button
                      type="button"
                      onClick={() => setAgendaFilterMode('day')}
                      className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-sm transition text-center cursor-pointer ${
                        agendaFilterMode === 'day' 
                          ? 'bg-primary text-primary-foreground shadow-md font-bold' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Por Dia Específico
                    </button>
                  </div>

                  {agendaFilterMode === 'day' && (
                    <input
                      type="date"
                      value={agendaDateFilter}
                      onChange={(e) => setAgendaDateFilter(e.target.value)}
                      className="w-full sm:w-auto pl-3 pr-3 py-2 bg-background border border-border rounded-sm text-xs font-semibold focus:outline-none text-foreground focus:border-primary"
                    />
                  )}
                </div>
              </div>

              {/* Status count badges */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs uppercase tracking-wider font-bold py-1 px-2.5">
                  Total: {filteredAgendamentos.length}
                </Badge>
                <Badge className="text-xs uppercase tracking-wider font-bold py-1 px-2.5 bg-primary/10 text-primary border border-primary/20">
                  Agendados: {filteredAgendamentos.filter(b => b.status === 'agendado' || b.status === 'confirmado').length}
                </Badge>
                <Badge className="text-xs uppercase tracking-wider font-bold py-1 px-2.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                  Concluídos: {filteredAgendamentos.filter(b => b.status === 'concluido').length}
                </Badge>
                <Badge className="text-xs uppercase tracking-wider font-bold py-1 px-2.5 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40">
                  Cancelados: {filteredAgendamentos.filter(b => b.status === 'cancelado' || b.status === 'faltou').length}
                </Badge>
              </div>

              {filteredAgendamentos.length === 0 ? (
                <div className="py-16 text-center space-y-3 bg-card border border-dashed border-border rounded-sm">
                  <CalendarX className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    {agendaFilterMode === 'upcoming' 
                      ? 'Nenhum compromisso agendado para hoje ou dias futuros.' 
                      : `Nenhum compromisso agendado para o dia ${agendaDateFilter.split('-').reverse().join('/')}.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAgendamentos.map((b) => {
                    const servLabel = servicos.find(s => s.id === b.servico_id)?.nome || 'Corte de Cabelo';
                    const matchedClient = b.cliente_id ? clientes.find(c => c.id === b.cliente_id) : null;
                    
                    return (
                      <div
                        key={b.id}
                        className={`p-5 rounded-sm border border-l-4 transition-all ${
                          b.status === 'concluido'
                            ? 'bg-card/30 border-border border-l-emerald-500 opacity-60'
                            : b.status === 'cancelado' || b.status === 'faltou'
                            ? 'bg-red-100 dark:bg-red-950/10 border-red-200 dark:border-red-950/40 border-l-red-500 opacity-50'
                            : 'bg-card border-border border-l-primary shadow-sm hover:border-primary/40'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-2">
                            {/* Date, Time and service */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-muted-foreground bg-card border border-border px-2.5 py-1 rounded-sm">
                                {b.inicio_em.split('T')[0].split('-').reverse().join('/')}
                              </span>
                              <span className="font-bold text-primary text-sm bg-primary/10 px-2.5 py-1 rounded-sm border border-primary/20">
                                {b.inicio_em.split('T')[1].substring(0, 5)}h
                              </span>
                              <span className="text-foreground">|</span>
                              <span className="font-sans font-semibold text-foreground text-xs sm:text-sm">{servLabel}</span>
                              <span className="text-foreground">|</span>
                              <span className="text-primary text-xs font-bold">{formatBRL(b.preco_cobrado)}</span>
                            </div>

                            {/* Client particulars details */}
                            <div className="space-y-1">
                              <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                                Cliente: {b.nome_cliente}
                                {b.cliente_id ? (
                                  <span className="text-xs bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 px-1.5 py-0.5 rounded-sm font-bold">Fiel</span>
                                ) : (
                                  <span className="text-xs bg-card text-muted-foreground border border-border px-1.5 py-0.5 rounded-sm">Simples</span>
                                )}
                              </h4>
                              <p className="text-muted-foreground text-xs">Contato: {b.telefone_cliente}</p>
                              {b.observacao && (
                                <p className="text-primary text-xs bg-primary/5 p-2 rounded-sm border border-primary/10 ">
                                  "{b.observacao}"
                                </p>
                              )}

                              {/* Show client custom technical observations (ignora nota automática de auto-cadastro) */}
                              {matchedClient?.observacoes && matchedClient.observacoes !== 'Auto-cadastrado via agendamento online' && (
                                <div className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/10 p-2 rounded-sm border border-emerald-200 dark:border-emerald-900/30 mt-2 leading-relaxed">
                                  <span className="font-bold block text-xs uppercase text-emerald-500">Nota Técnica Carlos:</span>
                                  {matchedClient.observacoes}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Quick Controls */}
                          <div className="pt-3 sm:pt-0 border-t sm:border-t-0 border-border flex flex-wrap items-center gap-2">
                            {/* Highlighted quick actions */}
                            {b.status !== 'concluido' && b.status !== 'cancelado' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateBookingStatus(b.id, 'concluido')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wide bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/20 transition cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Concluir
                              </button>
                            )}
                            {b.status !== 'cancelado' && b.status !== 'concluido' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateBookingStatus(b.id, 'cancelado')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wide bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-900/20 transition cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" /> Cancelar
                              </button>
                            )}
                            <a
                              href={getWhatsAppLink(b.telefone_cliente)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wide bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 transition cursor-pointer"
                            >
                              <FaWhatsapp size={14} /> WhatsApp
                            </a>

                            {/* Link fidelidade selector */}
                            {!b.cliente_id && (
                              <div className="relative">
                                <select
                                  onChange={(e) => handleLinkClientToBooking(b.id, e.target.value)}
                                  defaultValue=""
                                  className="text-xs bg-background hover:bg-accent border border-border p-1.5 rounded-sm text-muted-foreground focus:outline-none focus:border-primary"
                                >
                                  <option value="" disabled>Vincular Ficha...</option>
                                  {clientes.map(c => (
                                    <option key={c.id} value={c.id}>{c.nome}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Status changer */}
                            <select
                              value={b.status}
                              onChange={(e) => handleUpdateBookingStatus(b.id, e.target.value)}
                              className={`text-xs font-bold p-1.5 rounded-sm border focus:outline-none capitalize ${
                                b.status === 'concluido' 
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30'
                                  : b.status === 'agendado'
                                  ? 'bg-card text-muted-foreground border-border'
                                  : b.status === 'confirmado'
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/40'
                              }`}
                            >
                              <option value="agendado">agendado</option>
                              <option value="confirmado">confirmado</option>
                              <option value="concluido">concluido (Baixa Receita)</option>
                              <option value="cancelado">cancelado</option>
                              <option value="faltou">faltou</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}


          {/* TAB 3: SERVICES CRUD */}
          {activeTab === 'servicos' && (
            <div className="space-y-8">
              <div>
                <h2 className="font-normal text-2xl text-foreground tracking-tight">Catálogo de Serviços</h2>
                <p className="text-muted-foreground text-xs mt-1">Crie e edite preços, descrições e durações dos serviços no site público</p>
              </div>

              {/* Service Form */}
              <form onSubmit={handleSaveService} className="bg-card p-6 rounded-lg border border-border grid grid-cols-1 md:grid-cols-2 gap-5">
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
                  <Label>URL da imagem decorativa</Label>
                  <Input
                    type="url"
                    value={newService.imagem_url}
                    onChange={(e) => setNewService({ ...newService, imagem_url: e.target.value })}
                    placeholder="Cole um link de imagem do Unsplash"
                  />
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


          {/* TAB 3b: PLANOS (assinantes do plano VIP fixo) */}
          {activeTab === 'planos' && (
            <div className="space-y-8">
              <div>
                <h2 className="font-normal text-2xl text-foreground tracking-tight">Configurar Planos</h2>
                <p className="text-muted-foreground text-xs mt-1">Acompanhe quem está assinado no plano recorrente e quem está com a renovação atrasada.</p>
              </div>

              {/* Plano fixo (por enquanto não editável) */}
              <div className="bg-card p-5 rounded-sm border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-1">Plano VIP</h4>
                  <p className="text-sm text-foreground font-semibold">Corte de cabelo e barba à vontade durante todo o mês</p>
                  <p className="text-xs text-muted-foreground mt-1">Cobrança recorrente no cartão via Stripe (integração pendente de configuração).</p>
                </div>
                <div className="text-2xl font-bold text-primary shrink-0">{formatBRL(120)}<span className="text-xs text-muted-foreground font-normal">/mês</span></div>
              </div>

              {/* Resumo de assinantes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-card border border-border rounded-sm space-y-1">
                  <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Total de Assinantes</span>
                  <h3 className="font-bold text-xl text-foreground">{assinantesVIP.length}</h3>
                </div>
                <div className="p-4 bg-card border border-border rounded-sm space-y-1">
                  <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Renovados</span>
                  <h3 className="font-bold text-xl text-emerald-600 dark:text-emerald-400">{assinantesVIP.filter(a => a.renovado).length}</h3>
                </div>
                <div className="p-4 bg-card border border-border rounded-sm space-y-1">
                  <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Não Renovados</span>
                  <h3 className="font-bold text-xl text-red-600 dark:text-red-400">{assinantesVIP.filter(a => !a.renovado).length}</h3>
                </div>
              </div>

              {/* Lista de assinantes */}
              <div className="space-y-3">
                <h4 className="text-sm tracking-wide text-foreground font-semibold">Clientes Assinantes</h4>
                {assinantesVIP.length === 0 ? (
                  <div className="py-12 text-center bg-card border border-dashed border-border rounded-sm">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Nenhum cliente assinou o plano VIP ainda.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-sm border border-border bg-card">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-background border-b border-border text-muted-foreground font-semibold text-xs uppercase tracking-wider">
                          <th className="p-3">Cliente</th>
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
              <div>
                <h2 className="font-normal text-2xl text-foreground tracking-tight">Gestão de Produtos / Estoque</h2>
                <p className="text-muted-foreground text-xs mt-1">Exponha pomadas e shampoos na vitrine e modifique as unidades de estoque</p>
              </div>

              {/* Product Form */}
              <form onSubmit={handleSaveProduct} className="bg-card p-6 rounded-lg border border-border grid grid-cols-1 md:grid-cols-2 gap-5">
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
                  <Label>URL imagem ilustrativa</Label>
                  <Input
                    type="url"
                    value={newProduct.imagem_url}
                    onChange={(e) => setNewProduct({ ...newProduct, imagem_url: e.target.value })}
                    placeholder="Cole um link de imagem do Unsplash"
                  />
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
              <div>
                <h2 className="font-normal text-2xl text-foreground tracking-tight">Cadastro de Clientes</h2>
                <p className="text-muted-foreground text-xs mt-1">Crie prontuários, registre limitações térmicas, químicas ou de preferência de cada cliente</p>
              </div>

              {/* Client Form */}
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

                <div className="space-y-1.5">
                  <Label>E-mail (opcional)</Label>
                  <Input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="cliente@exemplo.com"
                  />
                </div>

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
                        setNewClient({ nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '' });
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
                                        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40'
                                        : 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40'
                                    }`}
                                  >
                                    {vipEntry.renovado ? 'VIP' : 'VIP vencido'}
                                  </Badge>
                                )}
                              </h5>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">{c.email || 'Sem e-mail'}</p>
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
                          {c.email && (
                            <p className="flex items-center gap-1.5">
                              <span className="text-muted-foreground">E-mail:</span>
                              <span className="text-muted-foreground">{c.email}</span>
                            </p>
                          )}
                        </div>

                        {c.observacoes && (
                          <div className="text-xs text-muted-foreground bg-muted border border-border p-2.5 rounded-sm whitespace-pre-line leading-relaxed">
                            "{c.observacoes}"
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
              <div>
                <h2 className="font-normal text-2xl text-foreground tracking-tight">Fluxo de Caixa</h2>
                <p className="text-muted-foreground text-xs mt-1 font-sans">Lançamentos independentes (aluguel, água, compras manuais de insumos) que alteram os balanços gerais no painel principal</p>
              </div>
 
              {/* Lançamento manual form */}
              <form
                onSubmit={handleSaveFinanceLaunch}
                className="bg-card p-6 rounded-lg border border-border space-y-5"
              >
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground mb-4">
                    Registrar Movimentação Manual
                  </h4>

                  {/* Tipo toggle — verde/vermelho */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      id="finance-type-entrada"
                      type="button"
                      onClick={() => {
                        setNewLaunch({ ...newLaunch, tipo: 'entrada' });
                        setTimeout(() => (document.getElementById('finance-valor') as HTMLInputElement)?.focus(), 50);
                      }}
                      className={`py-3 rounded-sm font-bold text-sm tracking-wide border-2 transition-all cursor-pointer ${
                        newLaunch.tipo === 'entrada'
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                          : 'bg-background border-border text-muted-foreground hover:border-emerald-600 hover:text-emerald-500'
                      }`}
                    >
                      ↑ ENTRADA
                    </button>
                    <button
                      id="finance-type-saida"
                      type="button"
                      onClick={() => {
                        setNewLaunch({ ...newLaunch, tipo: 'saida' });
                        setTimeout(() => (document.getElementById('finance-valor') as HTMLInputElement)?.focus(), 50);
                      }}
                      className={`py-3 rounded-sm font-bold text-sm tracking-wide border-2 transition-all cursor-pointer ${
                        newLaunch.tipo === 'saida'
                          ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-900/30'
                          : 'bg-background border-border text-muted-foreground hover:border-red-500 hover:text-red-500'
                      }`}
                    >
                      ↓ SAÍDA
                    </button>
                  </div>
                </div>

                {/* Valor em destaque */}
                <div className="space-y-1.5">
                  <Label>Valor (R$)</Label>
                  <div className="relative">
                    <span
                      className={`absolute left-4 top-1/2 -translate-y-1/2 font-bold text-2xl select-none pointer-events-none ${
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
                        // Substitui pontos por vírgulas se o usuário digitar ponto do teclado numérico
                        inputVal = inputVal.replace('.', ',');
                        // Permite apenas dígitos e no máximo 1 vírgula
                        const parts = inputVal.split(',');
                        if (parts.length > 2) return; // ignora segunda vírgula
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
                      className="w-full pl-16 pr-4 py-4 text-3xl font-bold rounded-sm border border-border bg-background outline-none focus:outline-none focus:ring-0 focus:border-border transition-all placeholder:text-muted-foreground/30 text-foreground"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label>Descrição operacional (opcional)</Label>
                    <Input
                      type="text"
                      value={newLaunch.descricao}
                      onChange={(e) => setNewLaunch({ ...newLaunch, descricao: e.target.value })}
                      placeholder="Ex: Compra de golas higiênicas"
                      className="rounded-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Categoria do lançamento</Label>
                    <Select value={newLaunch.categoria} onValueChange={(v) => v && setNewLaunch({ ...newLaunch, categoria: v as string })}>
                      <SelectTrigger className="w-full rounded-sm">
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
                    <button
                      type="button"
                      onClick={() => {
                        setNewCategoryType(newLaunch.tipo as 'entrada' | 'saida');
                        setIsCategoryModalOpen(true);
                      }}
                      className="text-primary hover:text-primary/80 text-xs uppercase flex items-center gap-1 cursor-pointer"
                    >
                      <Settings className="w-3 h-3" /> Configurar Categorias
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Forma de pagamento</Label>
                    <Select value={newLaunch.forma_pagamento} onValueChange={(v) => v && setNewLaunch({ ...newLaunch, forma_pagamento: v as any })}>
                      <SelectTrigger className="w-full rounded-sm">
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
                    <Label>Data de registro</Label>
                    <Input
                      type="date"
                      required
                      value={newLaunch.data}
                      onChange={(e) => setNewLaunch({ ...newLaunch, data: e.target.value })}
                      className="rounded-sm"
                    />
                  </div>
                </div>

                {/* Optional linked product selection */}
                {newLaunch.tipo === 'entrada' && (
                  <div className="space-y-1.5">
                    <Label>Abater 1 unidade do estoque deste produto? (opcional)</Label>
                    <Select value={newLaunch.produto_id || 'none'} onValueChange={(v) => setNewLaunch({ ...newLaunch, produto_id: (!v || v === 'none') ? '' : (v as string) })}>
                      <SelectTrigger className="w-full rounded-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não descontar venda de estoque</SelectItem>
                        {produtos.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.nome} (Estoque: {p.estoque} uni)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="pt-2 border-t border-border">
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`w-full py-4 rounded-sm font-bold text-lg tracking-wide text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      newLaunch.tipo === 'entrada'
                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/30'
                        : 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/30'
                    }`}
                  >
                    {submitting ? 'Salvando...' : newLaunch.tipo === 'entrada' ? '↑ Registrar Entrada' : '↓ Registrar Saída'}
                  </button>
                </div>
              </form>
 
              {/* Logs history complete */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-sm tracking-wide text-foreground font-semibold">Logs do Fluxo de Caixa (Histórico Completo)</h4>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="text-muted-foreground hover:text-primary hover:border-primary border border-border bg-background px-3 py-1.5 rounded-sm text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto transition"
                  >
                    <Settings className="w-3.5 h-3.5" /> Ajustar Categorias
                  </button>
                </div>

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

               {/* Card - Definir Intervalo Padrão de Almoço */}
              <div className="p-4 bg-card border border-border rounded-sm space-y-3.5">
                <div className="space-y-1">
                  <h4 className="text-sm tracking-wide text-foreground font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Definir Almoço Padrão (Em Lote)
                  </h4>
                  <p className="text-muted-foreground text-xs text-left">Ajuste o intervalo de almoço padrão e aplique instantaneamente a todos os dias da semana de uma só vez:</p>
                </div>

                <div className="flex flex-wrap items-end gap-4 text-xs">
                  <div className="space-y-1 w-28 text-left">
                    <span className="text-xs text-muted-foreground block font-bold uppercase tracking-wider">Início Almoço:</span>
                    <input 
                      type="text" 
                      placeholder="Ex: 12:00"
                      value={defaultIntervalStart}
                      onChange={(e) => setDefaultIntervalStart(e.target.value)}
                      className="bg-background border border-border p-2 px-3 rounded-sm w-full text-xs text-muted-foreground focus:border-primary focus:outline-none placeholder-stone-700"
                    />
                  </div>
                  <div className="space-y-1 w-28 text-left">
                    <span className="text-xs text-muted-foreground block font-bold uppercase tracking-wider">Fim Almoço:</span>
                    <input 
                      type="text" 
                      placeholder="Ex: 13:00"
                      value={defaultIntervalEnd}
                      onChange={(e) => setDefaultIntervalEnd(e.target.value)}
                      className="bg-background border border-border p-2 px-3 rounded-sm w-full text-xs text-muted-foreground focus:border-primary focus:outline-none placeholder-stone-700"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyDefaultInterval}
                    className="bg-primary text-primary-foreground hover:bg-primary/80 px-4 py-2.5 rounded-sm text-xs font-bold uppercase tracking-wider shadow-md transition shrink-0 cursor-pointer"
                  >
                    Aplicar em Todos os Dias
                  </button>
                </div>
              </div>

              {/* Expedientes grid configuration */}
              <div className="space-y-4">
                <h4 className="text-sm tracking-wide text-foreground font-semibold">Acordo de Turno Semanal (Expediente)</h4>
                
                <div className="grid grid-cols-1 gap-3.5">
                  {configuracoes.expedientes.map((ex) => (
                    <div 
                      key={ex.id} 
                      className={`p-4 rounded-sm border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                        ex.ativo ? 'border-border bg-card' : 'border-border bg-muted opacity-60'
                      }`}
                    >
                      {/* Name and active switch toggle button */}
                      <div className="flex justify-between items-center md:block">
                        <span className="font-sans font-bold text-foreground text-xs block">
                          {getDayName(ex.dia_semana)}
                        </span>
                        
                        <button
                          type="button"
                          onClick={() => handleUpdateExpediente(ex.id, { ativo: !ex.ativo })}
                          className={`mt-1.5 p-1 px-2.5 rounded-sm text-xs font-bold uppercase tracking-wider border transition ${
                            ex.ativo 
                              ? 'bg-primary border-primary text-primary-foreground hover:bg-primary/80' 
                              : 'bg-card border-border text-muted-foreground hover:text-muted-foreground'
                          }`}
                        >
                          {ex.ativo ? 'Expediente Ativo' : 'Expediente Parado'}
                        </button>
                      </div>

                      {/* Config shifts values form */}
                      {ex.ativo && (
                        <div className="flex-1 max-w-lg grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground block font-bold uppercase tracking-wider">Hora Início:</span>
                            <input 
                              type="text" 
                              defaultValue={ex.hora_inicio} 
                              onBlur={(e) => handleUpdateExpediente(ex.id, { hora_inicio: e.target.value })}
                              className="bg-background border border-border p-1 px-2 rounded-sm w-full font-bold text-foreground focus:border-primary focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground block font-bold uppercase tracking-wider">Hora Fim:</span>
                            <input 
                              type="text" 
                              defaultValue={ex.hora_fim} 
                              onBlur={(e) => handleUpdateExpediente(ex.id, { hora_fim: e.target.value })}
                              className="bg-background border border-border p-1 px-2 rounded-sm w-full font-bold text-foreground focus:border-primary focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground block font-bold uppercase tracking-wider">Almoço Início:</span>
                            <input 
                              type="text" 
                              defaultValue={ex.intervalo_inicio || ''} 
                              onBlur={(e) => handleUpdateExpediente(ex.id, { intervalo_inicio: e.target.value || null })}
                              className="bg-background border border-border p-1 px-2 rounded-sm w-full font-bold text-foreground focus:border-primary focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground block font-bold uppercase tracking-wider">Almoço Fim:</span>
                            <input 
                              type="text" 
                              defaultValue={ex.intervalo_fim || ''} 
                              onBlur={(e) => handleUpdateExpediente(ex.id, { intervalo_fim: e.target.value || null })}
                              className="bg-background border border-border p-1 px-2 rounded-sm w-full font-bold text-foreground focus:border-primary focus:outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
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
    </div>
  );
}
