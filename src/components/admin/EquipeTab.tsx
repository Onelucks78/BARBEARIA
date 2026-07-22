import React, { useState, useRef } from 'react';
import { Plus, User, Loader2, Camera, X } from 'lucide-react';
import { Profissional } from '../../types.ts';
import { authedFetch } from '../../lib/supabase.ts';
import { cropSquareToDataUrl, uploadImagem } from '../../lib/imagem.ts';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Textarea } from '@/components/ui/textarea.tsx';
import { Badge } from '@/components/ui/badge.tsx';

interface EquipeTabProps {
  profissionais: Profissional[];
  onChanged: () => void; // recarrega a lista no pai
}

const VAZIO = { nome: '', telefone: '', bio: '', avatar_url: '' };

/**
 * Aba Equipe — CRUD dos barbeiros que atendem na barbearia.
 *
 * Não existe exclusão de propósito: agendamentos.profissional_id é NOT NULL,
 * então apagar um barbeiro quebraria o histórico financeiro. Desativar tira
 * ele dos novos agendamentos e preserva tudo que já passou.
 */
export default function EquipeTab({ profissionais, onChanged }: EquipeTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erro, setErro] = useState('');
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const escolherFoto = async (file: File | undefined) => {
    if (!file) return;
    setEnviandoFoto(true);
    setErro('');
    try {
      // Recorte quadrado: o card e o wizard mostram a foto em moldura 1:1
      const dataUrl = await cropSquareToDataUrl(file);
      const url = await uploadImagem(dataUrl, 'profissionais');
      setForm(prev => ({ ...prev, avatar_url: url }));
    } catch (err: any) {
      setErro(err.message || 'Não foi possível enviar a foto.');
    } finally {
      setEnviandoFoto(false);
      if (inputFotoRef.current) inputFotoRef.current.value = '';
    }
  };

  const fecharForm = () => {
    setShowForm(false);
    setEditandoId(null);
    setForm(VAZIO);
    setErro('');
  };

  const abrirEdicao = (p: Profissional) => {
    setEditandoId(p.id);
    setForm({
      nome: p.nome,
      telefone: p.telefone ?? '',
      bio: p.bio ?? '',
      avatar_url: p.avatar_url ?? ''
    });
    setShowForm(true);
    setErro('');
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      setErro('O nome do barbeiro é obrigatório.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const url = editandoId
        ? `/api/admin/profissionais/${editandoId}`
        : '/api/admin/profissionais';
      const res = await authedFetch(url, {
        method: editandoId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome.trim(),
          telefone: form.telefone.trim(),
          bio: form.bio.trim(),
          // no PATCH, null limpa a foto; no POST o campo é simplesmente omitido
          avatar_url: form.avatar_url || (editandoId ? null : undefined)
        })
      });
      const text = await res.text();
      let body: any = {};
      try { body = JSON.parse(text); } catch {}
      if (!res.ok) throw new Error(body.error || 'Não foi possível salvar.');
      fecharForm();
      onChanged();
    } catch (err: any) {
      setErro(err.message || 'Erro inesperado ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (p: Profissional) => {
    try {
      const res = await authedFetch(`/api/admin/profissionais/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !p.ativo })
      });
      const text = await res.text();
      let body: any = {};
      try { body = JSON.parse(text); } catch {}
      if (!res.ok) {
        throw new Error(body.error || 'Falha ao alterar o status.');
      }
      onChanged();
    } catch (err: any) {
      setErro(err.message || 'Erro ao alterar o status.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground">Equipe</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Barbeiros que atendem nesta barbearia. Cada um tem agenda e faturamento próprios.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => (showForm ? fecharForm() : setShowForm(true))}
          className="shrink-0"
        >
          <Plus className="w-4 h-4" /> {showForm ? 'Fechar' : 'Novo Barbeiro'}
        </Button>
      </div>

      {erro && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-4 py-3">
          {erro}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={salvar}
          className="bg-card p-6 rounded-lg border border-border grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          <div className="md:col-span-2">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground mb-2">
              {editandoId ? 'Editar barbeiro' : 'Adicionar barbeiro à equipe'}
            </h4>
            {!editandoId && (
              <p className="text-xs text-muted-foreground">
                O expediente será copiado de um barbeiro já cadastrado. Ajuste depois em Configurações.
              </p>
            )}
          </div>

          {/* Foto do barbeiro — aparece no card e na escolha do cliente */}
          <div className="md:col-span-2 space-y-1.5">
            <Label>Foto do barbeiro</Label>
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {form.avatar_url ? (
                  <>
                    <img
                      src={form.avatar_url}
                      alt="Foto do barbeiro"
                      className="w-20 h-20 rounded-md object-cover border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, avatar_url: '' })}
                      title="Remover foto"
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md hover:scale-110 transition cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <div className="w-20 h-20 rounded-md bg-muted border border-border border-dashed flex items-center justify-center">
                    <User className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <input
                  ref={inputFotoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => escolherFoto(e.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={enviandoFoto}
                  onClick={() => inputFotoRef.current?.click()}
                >
                  {enviandoFoto ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  ) : (
                    <><Camera className="w-4 h-4" /> {form.avatar_url ? 'Trocar foto' : 'Escolher foto'}</>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG ou WebP. A imagem é recortada em quadrado automaticamente.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              type="text"
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Nome do barbeiro"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Telefone (opcional)</Label>
            <Input
              type="tel"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="Ex: (11) 98765-1234"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Descrição (aparece para o cliente no agendamento)</Label>
            <Textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Ex: Especialista em degradê e barba na navalha."
              rows={3}
            />
          </div>

          <div className="md:col-span-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={fecharForm}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
              {editandoId ? 'Salvar alterações' : 'Adicionar'}
            </Button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {profissionais.length === 0 && (
          <p className="text-xs text-muted-foreground col-span-full py-8 text-center">
            Nenhum barbeiro cadastrado ainda.
          </p>
        )}

        {profissionais.map((p) => (
          <div
            key={p.id}
            className={`bg-card p-5 rounded-lg border flex items-start gap-4 transition ${
              p.ativo ? 'border-border' : 'border-border/50 opacity-60'
            }`}
          >
            {p.avatar_url ? (
              <img
                src={p.avatar_url}
                alt={p.nome}
                className="w-14 h-14 rounded-md object-cover shrink-0 border border-border"
              />
            ) : (
              <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center shrink-0">
                <User className="w-6 h-6 text-muted-foreground" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-foreground text-sm truncate">{p.nome}</h4>
                <Badge variant={p.ativo ? 'default' : 'secondary'} className="shrink-0">
                  {p.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              {p.telefone && (
                <p className="text-xs text-muted-foreground mt-1">{p.telefone}</p>
              )}
              {p.bio && (
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                  {p.bio}
                </p>
              )}

              <div className="mt-3 pt-3 border-t border-border flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => abrirEdicao(p)}
                  className="text-xs font-bold uppercase tracking-wider text-primary hover:underline cursor-pointer"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => alternarAtivo(p)}
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {p.ativo ? 'Desativar' : 'Reativar'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
