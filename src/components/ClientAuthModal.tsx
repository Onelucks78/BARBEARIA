import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Phone, Lock, User, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { signInClientTelefone, signUpClientTelefone } from '../lib/useAdminSession.ts';
import { supabase } from '../lib/supabase.ts';

interface ClientAuthModalProps {
  onClose: () => void;
  onLoginSuccess?: () => void;
}

/** Máscara visual (11) 98765-4321. O valor enviado é sempre só dígitos. */
function formatarTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function ClientAuthModal({ onClose, onLoginSuccess }: ClientAuthModalProps) {
  const [aba, setAba] = useState<'entrar' | 'criar'>('entrar');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      if (sessao) {
        onLoginSuccess?.();
        onClose();
      }
    });
    return () => subscription.unsubscribe();
  }, [onLoginSuccess, onClose]);

  const trocarAba = (nova: 'entrar' | 'criar') => {
    setAba(nova);
    setErro('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const resultado = aba === 'entrar'
        ? await signInClientTelefone(telefone, senha)
        : await signUpClientTelefone(nome, telefone, senha);

      if (resultado.error) {
        // Telefone já cadastrado: em vez de só reclamar, joga o cliente na aba certa
        // com o telefone preservado.
        if ((resultado.error as any).code === 'telefone_ja_cadastrado') {
          setAba('entrar');
          setSenha('');
          setErro('Esse telefone já tem conta. Digite sua senha para entrar.');
          return;
        }
        // O Supabase responde em inglês; traduzimos o caso mais comum.
        const msg = (resultado.error as any).message || '';
        setErro(/invalid login credentials/i.test(msg)
          ? 'Telefone ou senha incorretos.'
          : msg || 'Não foi possível continuar.');
        return;
      }

      onLoginSuccess?.();
      onClose();
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível continuar.');
    } finally {
      setCarregando(false);
    }
  };

  const abaClasse = (ativa: boolean) =>
    `flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest rounded-sm transition ${
      ativa
        ? 'bg-primary text-primary-foreground'
        : 'bg-transparent text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-card border border-border rounded-sm w-full max-w-md shadow-2xl overflow-hidden z-10"
      >
        <div className="p-6 bg-sidebar text-foreground flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide text-foreground">Entrar com telefone</h3>
              <p className="text-[10px] text-muted-foreground">Sem precisar de conta do Google.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-sm hover:bg-accent transition"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex gap-1 p-1 bg-background border border-border rounded-sm">
            <button type="button" className={abaClasse(aba === 'entrar')} onClick={() => trocarAba('entrar')}>
              Já tenho conta
            </button>
            <button type="button" className={abaClasse(aba === 'criar')} onClick={() => trocarAba('criar')}>
              Criar conta
            </button>
          </div>

          {erro && (
            <div className="p-3.5 bg-destructive/10 border border-destructive/40 text-destructive rounded-sm text-xs flex gap-2 items-start leading-relaxed">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {aba === 'criar' && (
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">Seu nome</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/70" />
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Como podemos te chamar"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-background border border-input rounded-sm text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">Telefone</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/70" />
                <input
                  type="tel"
                  inputMode="numeric"
                  value={formatarTelefone(telefone)}
                  onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ''))}
                  placeholder="(11) 98765-4321"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-background border border-input rounded-sm text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/70" />
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder={aba === 'criar' ? 'Crie uma senha (mínimo 6)' : 'Sua senha'}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-10 py-3 bg-background border border-input rounded-sm text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-[10px] font-bold uppercase tracking-widest rounded-sm transition duration-150 cursor-pointer"
            >
              {carregando
                ? 'Aguarde...'
                : aba === 'entrar' ? 'Entrar' : 'Criar minha conta'}
            </button>
          </form>

          {aba === 'entrar' && (
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed pt-2 border-t border-border">
              Esqueceu a senha? Fale com a barbearia pelo WhatsApp que a gente cadastra
              uma nova para você.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
