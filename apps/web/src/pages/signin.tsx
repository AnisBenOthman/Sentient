import { Link, useLocation } from "wouter";
import { useState } from "react";

const QUICK_PICKS = [
  { label: "HR Admin",     email: "hradmin@sentient.dev",  password: "Sentient@2026!" },
  { label: "Dept Manager", email: "manager@sentient.dev",  password: "Sentient@2026!" },
  { label: "Team Lead",    email: "teamlead@sentient.dev", password: "Sentient@2026!" },
  { label: "Employee",     email: "employee@sentient.dev", password: "Sentient@2026!" },
] as const;
import { useMutation } from "@tanstack/react-query";
import { Brain, Eye, EyeOff, ArrowRight, ArrowLeft } from "lucide-react";
import { login } from "@/lib/api/hr-core";
import { useAuth } from "@/components/providers/auth-provider";

export default function SignIn() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [, navigate] = useLocation();
  const { login: storeLogin } = useAuth();

  const { mutate, isPending, error } = useMutation({
    mutationFn: (creds: { email: string; password: string }) => login(creds.email, creds.password),
    onSuccess: (data) => {
      storeLogin(data.accessToken, data.refreshToken);
      navigate("/home");
    },
  });

  const errorMessage: string | null = error
    ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Invalid email or password.")
    : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutate({ email, password });
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundColor: "#faf8f5", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* Blob: bottom-right teal */}
      <svg
        className="absolute bottom-0 right-0 pointer-events-none"
        width="500" height="400" viewBox="0 0 500 400" fill="none"
        style={{ opacity: 0.25, color: "#0ea5e9" }}
      >
        <path d="M480 320C450 380 380 420 300 410C220 400 150 350 90 280C30 210 -10 120 10 50C30 -20 120 -60 210 -70C300 -80 390 -50 450 10C510 70 510 260 480 320Z" fill="currentColor" />
      </svg>

      {/* Blob: top-left violet */}
      <svg
        className="absolute top-0 left-0 pointer-events-none"
        width="350" height="300" viewBox="0 0 350 300" fill="none"
        style={{ opacity: 0.2, color: "#8b5cf6" }}
      >
        <path d="M320 80C350 140 330 220 270 260C210 300 130 310 70 280C10 250 -30 180 -40 110C-50 40 10 -20 80 -40C150 -60 230 -50 290 20C350 90 290 20 320 80Z" fill="currentColor" />
      </svg>

      {/* Blob: top-right small indigo */}
      <svg
        className="absolute top-0 right-[20%] pointer-events-none"
        width="200" height="180" viewBox="0 0 200 180" fill="none"
        style={{ opacity: 0.15, color: "#6366f1" }}
      >
        <path d="M180 50C200 80 190 130 150 160C110 190 60 180 30 150C0 120 -10 70 10 40C30 10 80 -10 120 0C160 10 160 20 180 50Z" fill="currentColor" />
      </svg>

      {/* Card */}
      <div
        className="relative z-10 bg-white rounded-[20px] p-10 w-full max-w-[420px] flex flex-col items-center"
        style={{ boxShadow: "0 8px 40px rgba(99,102,241,0.12)" }}
      >
        {/* Logo */}
        <div className="w-12 h-12 rounded-full bg-[#eef2ff] flex items-center justify-center mb-6">
          <Brain className="w-6 h-6 text-[#4f46e5]" />
        </div>

        <h1 className="text-2xl font-bold text-[#1e1b4b] mb-2" data-testid="signin-heading">
          Sentient HRIS
        </h1>
        <p className="text-slate-400 text-sm mb-8 text-center">Sign in to your workspace</p>

        <form onSubmit={handleSubmit} className="w-full space-y-4 mb-6" data-testid="signin-form">
          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-zinc-600" data-testid="label-email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              data-testid="input-email"
              className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#818cf8] focus:border-transparent transition-all"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-zinc-600" data-testid="label-password">
                Password
              </label>
              <Link href="/forgot-password">
                <button
                  type="button"
                  data-testid="btn-forgot-password"
                  className="text-sm text-[#4f46e5] hover:underline font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                data-testid="input-password"
                className="w-full h-11 px-3.5 pr-10 rounded-xl border border-gray-200 bg-white text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#818cf8] focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                data-testid="btn-toggle-password"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error message */}
          {errorMessage && (
            <p className="text-sm text-red-500 text-center -mt-1" data-testid="signin-error">
              {errorMessage}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            data-testid="btn-submit-signin"
            className="w-full h-11 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 mt-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#4338ca]"
            style={{ background: "#4f46e5" }}
          >
            {isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick sign-in picks */}
        <div className="w-full mb-4">
          <p className="text-xs text-slate-400 text-center mb-2">Quick sign-in as:</p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {QUICK_PICKS.map(({ label, email: qEmail, password: qPwd }) => (
              <button
                key={label}
                type="button"
                disabled={isPending}
                data-testid={`btn-quickpick-${label.toLowerCase().replace(" ", "-")}`}
                onClick={() => {
                  setEmail(qEmail);
                  setPassword(qPwd);
                  mutate({ email: qEmail, password: qPwd });
                }}
                className="px-2.5 py-1 rounded-full text-xs font-medium border border-[#4f46e5]/30 text-[#4f46e5] bg-[#eef2ff] hover:bg-[#4f46e5] hover:text-white transition-colors disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Back to home */}
        <Link href="/">
          <button
            data-testid="btn-back-home"
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 font-medium"
          >
            <ArrowLeft className="w-3 h-3" /> Back to home
          </button>
        </Link>
      </div>
    </div>
  );
}
