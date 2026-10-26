"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Mail, Lock, User, AlertCircle, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BottomNavigation } from "@/app/components/ui/BottomNavigation";

interface CadastroFormProps {
  redirectTo: string;
}

export function CadastroForm({ redirectTo }: CadastroFormProps) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password || !confirmPassword) {
      setError("Preencha todos os campos.");
      return;
    }

    if (!email.includes("@")) {
      setError("Digite um e-mail válido.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setIsLoading(true);

    const supabase = createClient();

    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (authError) {
      setIsLoading(false);
      switch (authError.message) {
        case "User already registered":
          setError("Este e-mail já está cadastrado. Tente fazer login.");
          break;
        case "Invalid email":
          setError("Digite um e-mail válido.");
          break;
        case "Password should be at least 6 characters":
          setError("A senha deve ter pelo menos 6 caracteres.");
          break;
        case "Too many requests":
          setError("Muitas tentativas. Aguarde um momento e tente novamente.");
          break;
        default:
          setError("Erro ao cadastrar. Tente novamente.");
      }
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (user && !user.email_confirmed_at) {
      setSuccess("Cadastro realizado! Verifique seu e-mail e clique no link de confirmação para entrar.");
    } else {
      setSuccess("Cadastro realizado! Entrando...");
      setTimeout(() => {
        router.push(redirectTo);
        router.refresh();
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 navbar-safe">
        <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3" aria-label="Civikoo - Início">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <span className="text-white text-lg">🏙️</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-white">Civikoo</h1>
              <p className="text-xs text-zinc-500">Cadastrar</p>
            </div>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 pt-20 pb-24 px-4 max-w-screen-xl mx-auto w-full">
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-2">
              <span className="text-amber-500">🏙️</span>
              Civikoo
            </h1>
            <p className="text-zinc-400 mt-2">Crie sua conta e ajude a melhorar sua cidade</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl p-6 sm:p-8">
            {success && (
              <div className="mb-6 flex items-center gap-2 text-green-400 bg-green-900/20 rounded-xl p-3" role="status">
                <CheckCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                <p className="text-sm font-medium">{success}</p>
              </div>
            )}

            {error && (
              <div className="mb-6 flex items-center gap-2 text-red-400 bg-red-900/20 rounded-xl p-3" role="alert">
                <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" aria-hidden="true" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-describedby={error ? "email-error" : undefined}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" aria-hidden="true" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    disabled={isLoading}
                    className="w-full pl-10 pr-12 py-3 rounded-xl border border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-describedby={error ? "password-error" : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" aria-hidden="true" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-describedby={error ? "confirm-error" : undefined}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold text-base flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-500/25 hover:shadow-xl active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                    Cadastrando...
                  </>
                ) : (
                  "Cadastrar"
                )}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-zinc-900 text-zinc-500">Já tem conta?</span>
              </div>
            </div>

            <p className="text-center text-zinc-400">
              <Link href={`/login?redirect=${encodeURIComponent(redirectTo)}`} className="font-medium text-amber-400 hover:text-amber-300 transition-colors">
                Entrar
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-zinc-500 mt-6">
            Ao continuar, você concorda com nossos
            <a href="#" className="underline hover:text-amber-400">Termos de Uso</a> e
            <a href="#" className="underline hover:text-amber-400 ml-1">Política de Privacidade</a>
          </p>
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
}