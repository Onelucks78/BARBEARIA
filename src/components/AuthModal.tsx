import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Lock, Mail, Phone, User, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import {
  signInAdminWithGoogle,
  signInClient,
  signInClientTelefone,
  signUpClientTelefone
} from '../lib/useAdminSession.ts';
import { supabase } from '../lib/supabase.ts';

interface AuthModalProps {
  onClose: () => void;
  onLoginSuccess: () => void;
}

/** Máscara visual (11) 98765-4321. O valor guardado é sempre só dígitos. */
function formatarTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Porta única do app. Cliente e barbeiro entram pelo mesmo lugar; quem decide o
// destino é App.tsx:213, olhando o role vindo do app_metadata do Supabase (que só
// o servidor consegue gravar). Antes esta tela se anunciava como "Escritório do
// Barbeiro / apenas para profissionais" e era o alvo dos botões "Assinar" —
// ou seja, o cliente que ia pagar o plano batia num aviso de acesso restrito.
type Tela = 'escolha' | 'telefone' | 'email';

export default function AuthModal({ onClose, onLoginSuccess }: AuthModalProps) {
  const [tela, setTela] = useState<Tela>('escolha');
  const [modoTelefone, setModoTelefone] = useState<'entrar' | 'criar'>('entrar');

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        onLoginSuccess();
        onClose();
      }
    });
    return () => subscription.unsubscribe();
  }, [onLoginSuccess, onClose]);

  const irPara = (t: Tela) => {
    setTela(t);
    setErrorMsg('');
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setErrorMsg('');
    try {
      const { error } = await signInAdminWithGoogle();
      if (error) throw error;
      onLoginSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível conectar com o Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleTelefoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const resultado = modoTelefone === 'entrar'
        ? await signInClientTelefone(telefone, senha)
        : await signUpClientTelefone(nome, telefone, senha);

      if (resultado.error) {
        if ((resultado.error as any).code === 'telefone_ja_cadastrado') {
          setModoTelefone('entrar');
          setSenha('');
          setErrorMsg('Esse telefone já tem conta. Digite sua senha para entrar.');
          return;
        }
        const msg = (resultado.error as any).message || '';
        setErrorMsg(/invalid login credentials/i.test(msg)
          ? 'Telefone ou senha incorretos.'
          : msg || 'Não foi possível continuar.');
        return;
      }
      onLoginSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Não foi possível continuar.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await signInClient(email, password);
      if (error) throw error;
      onLoginSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Credenciais inválidas.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Insira o seu e-mail no campo acima para receber as instruções.');
      return;
    }
    setErrorMsg('');
    supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
      .then(({ error }) => {
        if (error) setErrorMsg(error.message);
        else setErrorMsg(`Instruções enviadas para ${email}.`);
      });
  };

  const inputClass =
    'w-full pl-10 pr-4 py-3 bg-background border border-input rounded-sm text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20';

  const voltar = (
    <button
      type="button"
      onClick={() => irPara('escolha')}
      className="text-primary hover:text-primary/80 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 pb-2"
    >
      ◀ Voltar
    </button>
  );

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
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide text-foreground">Acesse sua conta</h3>
              <p className="text-[10px] text-muted-foreground">Agende, acompanhe seu plano e seus horários.</p>
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
          {errorMsg && (
            <div className="p-3.5 bg-destructive/10 border border-destructive/40 text-destructive rounded-sm text-xs flex gap-2 items-start leading-relaxed animate-shake">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
              <span>{errorMsg}</span>
            </div>
          )}

          {tela === 'escolha' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading || googleLoading}
                className="w-full py-3 bg-white text-black hover:bg-stone-200 disabled:opacity-50 text-[11px] font-bold uppercase tracking-widest rounded-sm transition duration-150 cursor-pointer flex items-center justify-center shadow-lg"
              >
                {googleLoading ? (
                  <span className="text-stone-600">Conectando...</span>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                    </svg>
                    Entrar com o Google
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => irPara('telefone')}
                className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] font-bold uppercase tracking-widest rounded-sm transition duration-150 cursor-pointer flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" />
                Entrar com telefone
              </button>

              <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                Não tem conta do Google? Use seu telefone — leva menos de um minuto.
              </p>

              <button
                type="button"
                onClick={() => irPara('email')}
                className="w-full py-2.5 bg-transparent border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground text-[10px] font-bold uppercase tracking-widest rounded-sm transition duration-150 cursor-pointer"
              >
                Entrar com e-mail e senha
              </button>

              {localStorage.getItem('supabase_offline') === 'true' && (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('mock_admin_session', 'true');
                    window.location.reload();
                  }}
                  className="w-full mt-4 py-3 bg-gradient-to-r from-primary to-primary/80 hover:brightness-110 text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-md transition duration-150 cursor-pointer text-center shadow-md"
                >
                  ⚠️ Entrar no Modo de Teste Offline
                </button>
              )}
            </div>
          )}

          {tela === 'telefone' && (
            <div className="space-y-4">
              {voltar}

              <div className="flex gap-1 p-1 bg-background border border-border rounded-sm">
                <button
                  type="button"
                  onClick={() => { setModoTelefone('entrar'); setErrorMsg(''); }}
                  className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest rounded-sm transition ${
                    modoTelefone === 'entrar' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Já tenho conta
                </button>
                <button
                  type="button"
                  onClick={() => { setModoTelefone('criar'); setErrorMsg(''); }}
                  className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest rounded-sm transition ${
                    modoTelefone === 'criar' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Criar conta
                </button>
              </div>

              <form onSubmit={handleTelefoneSubmit} className="space-y-4">
                {modoTelefone === 'criar' && (
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
                        className={inputClass}
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
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/70" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder={modoTelefone === 'criar' ? 'Crie uma senha (mínimo 6)' : 'Sua senha'}
                      required
                      minLength={6}
                      className={`${inputClass} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-[10px] font-bold uppercase tracking-widest rounded-sm transition duration-150 cursor-pointer"
                >
                  {loading ? 'Aguarde...' : modoTelefone === 'entrar' ? 'Entrar' : 'Criar minha conta'}
                </button>
              </form>

              {modoTelefone === 'entrar' && (
                <p className="text-[10px] text-muted-foreground text-center leading-relaxed pt-2 border-t border-border">
                  Esqueceu a senha? Fale com a barbearia pelo WhatsApp que a gente cadastra uma nova para você.
                </p>
              )}
            </div>
          )}

          {tela === 'email' && (
            <div className="space-y-4">
              {voltar}
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/70" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/70" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Sua senha"
                      className={`${inputClass} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="pt-1 text-right">
                    <a
                      href="#esqueceu-senha"
                      onClick={handleForgotPassword}
                      className="text-[10px] text-primary hover:text-primary/80 transition-colors hover:underline"
                    >
                      Esqueceu sua senha?
                    </a>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-[10px] font-bold uppercase tracking-widest rounded-sm transition duration-150 cursor-pointer"
                >
                  {loading ? 'Acessando...' : 'Entrar'}
                </button>
              </form>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
