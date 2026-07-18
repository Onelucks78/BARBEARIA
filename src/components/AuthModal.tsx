import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Lock, Mail, ShieldAlert, ShieldOff, Eye, EyeOff } from 'lucide-react';
import { signInAdminWithGoogle, signInClient } from '../lib/useAdminSession.ts';
import { supabase } from '../lib/supabase.ts';

interface AuthModalProps {
  onClose: () => void;
  onLoginSuccess: () => void;
}

export default function AuthModal({ onClose, onLoginSuccess }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [deniedMsg, setDeniedMsg] = useState('');

  // Detecta login e permite fechar o modal para ambos
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        onLoginSuccess();
        onClose();
      }
    });
    return () => subscription.unsubscribe();
  }, [onLoginSuccess, onClose]);

  const handleAdminEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Preencha os dados do barbeiro.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setDeniedMsg('');
    try {
      const { data, error } = await signInClient(email, password);
      if (error) throw error;
      onLoginSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Credenciais inválidas.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setErrorMsg('');
    setDeniedMsg('');
    try {
      const { error } = await signInAdminWithGoogle();
      if (error) throw error;
      // OAuth redireciona; o useEffect valida a role no retorno
      onLoginSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível conectar com o Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Insira o seu e-mail no campo acima para receber as instruções.');
      return;
    }
    setErrorMsg('');
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    }).then(({ error }) => {
      if (error) setErrorMsg(error.message);
      else setErrorMsg(`Instruções enviadas para ${email}.`);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-card border border-border rounded-sm w-full max-w-md shadow-2xl overflow-hidden z-10"
      >
        <div className="p-6 bg-sidebar text-foreground flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-sm tracking-wide text-foreground">Escritório do Barbeiro</h3>
              <p className="text-[10px] text-muted-foreground">Entrada autorizada apenas para profissionais.</p>
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
          {deniedMsg && (
            <div className="p-3.5 bg-amber-950/40 border border-amber-800 text-amber-300 rounded-sm text-xs flex gap-2 items-start leading-relaxed animate-shake">
              <ShieldOff className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <span className="font-bold uppercase text-[9px] tracking-wider bg-amber-900/40 px-1 py-0.5 mr-1 rounded-sm">Acesso negado:</span> {deniedMsg}
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 bg-destructive/10 border border-destructive/40 text-destructive rounded-sm text-xs flex gap-2 items-start leading-relaxed animate-shake">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
              <div>
                <span className="font-bold uppercase text-[9px] tracking-wider bg-destructive/20 px-1 py-0.5 mr-1 rounded-sm">Aviso:</span> {errorMsg}
              </div>
            </div>
          )}

          {!showEmailForm ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading || googleLoading}
                className="w-full py-3 bg-white text-black hover:bg-stone-200 disabled:opacity-50 text-[11px] font-bold uppercase tracking-widest rounded-sm transition duration-150 cursor-pointer flex items-center justify-center font-mono shadow-lg"
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
                onClick={() => setShowEmailForm(true)}
                className="w-full py-3 bg-transparent border border-primary text-primary hover:bg-primary/10 text-[11px] font-bold uppercase tracking-widest rounded-sm transition duration-150 cursor-pointer flex items-center justify-center font-mono"
              >
                Entrar com E-mail e Senha
              </button>

              {localStorage.getItem('supabase_offline') === 'true' && (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('mock_admin_session', 'true');
                    window.location.reload();
                  }}
                  className="w-full mt-4 py-3 bg-gradient-to-r from-primary to-primary/80 hover:brightness-110 text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-md transition duration-150 cursor-pointer text-center font-mono shadow-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  ⚠️ Entrar no Modo de Teste Offline
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setShowEmailForm(false)}
                className="text-primary hover:text-primary/80 text-[11px] font-bold uppercase tracking-wider font-mono flex items-center gap-1 pb-2"
              >
                ◀ Voltar
              </button>
              <form onSubmit={handleAdminEmailLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground font-mono block">E-mail Administrativo:</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/70" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="barbeiro@imperial.com"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-background border border-input rounded-sm text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground font-mono block">Senha Secreta:</label>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/70" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Sua senha secreta"
                      className="w-full pl-10 pr-10 py-3 bg-background border border-input rounded-sm text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 font-mono"
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
                      className="text-[10px] font-mono text-primary hover:text-primary/80 transition-colors hover:underline"
                    >
                      Esqueceu sua senha?
                    </a>
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                  <button
                    type="submit"
                    disabled={loading || googleLoading}
                    className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-[10px] font-bold uppercase tracking-widest rounded-sm transition duration-150 cursor-pointer text-center"
                  >
                    {loading ? 'Acessando credenciais...' : 'Entrar no Escritório'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="pt-3 border-t border-border text-center">
            <p className="text-[10px] text-muted-foreground font-mono">
              Login via Supabase Auth · Google OAuth + E-mail/Senha
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
