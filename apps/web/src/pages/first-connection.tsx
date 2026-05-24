import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Brain, Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { claimInvite } from "@/lib/api/hr-core";

function validatePassword(pw: string): string | undefined {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(pw)) return "Must contain at least one uppercase letter.";
  if (!/[a-z]/.test(pw)) return "Must contain at least one lowercase letter.";
  if (!/\d/.test(pw)) return "Must contain at least one number.";
  if (!/[^a-zA-Z\d]/.test(pw)) return "Must contain at least one special character.";
  return undefined;
}

export default function FirstConnection() {
  const [, navigate] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string; api?: string }>({});

  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: () => claimInvite(token!, password),
    onSuccess: () => {
      setTimeout(() => navigate("/signin"), 3000);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      const apiMsg =
        msg.includes("Invalid or expired") ? "This invite link is invalid or has expired. Ask your HR admin to resend the invite." :
        msg.includes("too weak") || msg.includes("complexity") ? "Password does not meet the requirements." :
        msg.includes("reuse") ? "You cannot reuse a previous password." :
        "Something went wrong. Please try again.";
      setErrors((prev) => ({ ...prev, api: apiMsg }));
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pwErr = validatePassword(password);
    const confirmErr = password !== confirmPassword ? "Passwords do not match." : undefined;
    if (pwErr || confirmErr) {
      setErrors({ password: pwErr, confirmPassword: confirmErr });
      return;
    }
    setErrors({});
    mutate();
  }

  if (!token) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center p-4"
        style={{ backgroundColor: "#faf8f5", fontFamily: "Inter, system-ui, sans-serif" }}
      >
        <div
          className="bg-white rounded-[20px] p-10 w-full max-w-[420px] flex flex-col items-center gap-4"
          style={{ boxShadow: "0 8px 40px rgba(99,102,241,0.12)" }}
        >
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-[#1e1b4b]">Invalid invitation link</h1>
          <p className="text-slate-400 text-sm text-center">
            This link is missing a token. Please use the link from your invitation email, or ask your HR admin to resend it.
          </p>
          <Link href="/signin">
            <button className="mt-2 text-sm text-[#4f46e5] hover:underline font-medium">
              Back to Sign In
            </button>
          </Link>
        </div>
      </div>
    );
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

        <h1 className="text-2xl font-bold text-[#1e1b4b] mb-2" data-testid="first-connection-heading">
          Set your password
        </h1>
        <p className="text-slate-400 text-sm mb-8 text-center">
          Welcome! Create a password to activate your account.
        </p>

        {isSuccess ? (
          <div
            className="w-full flex flex-col items-center gap-4 py-4"
            data-testid="first-connection-success"
          >
            <div className="w-14 h-14 rounded-full bg-[#eef2ff] flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-[#4f46e5]" />
            </div>
            <p className="text-zinc-700 text-sm text-center font-medium">
              Your password has been set successfully.
            </p>
            <p className="text-slate-400 text-xs text-center">
              Redirecting you to sign in…
            </p>
            <Link href="/signin">
              <button
                data-testid="btn-go-to-signin"
                className="mt-2 w-full h-11 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:bg-[#4338ca]"
                style={{ background: "#4f46e5" }}
              >
                Go to Sign In
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="w-full space-y-4 mb-6" data-testid="first-connection-form">
              {errors.api && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3.5 py-3">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-red-600 text-xs leading-relaxed" data-testid="error-api">{errors.api}</p>
                </div>
              )}

              {/* New Password */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-zinc-600">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    placeholder="Min. 8 chars, upper, lower, number, symbol"
                    data-testid="input-password"
                    className={`w-full h-11 px-3.5 pr-10 rounded-xl border bg-white text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#818cf8] focus:border-transparent transition-all ${
                      errors.password ? "border-red-400" : "border-gray-200"
                    }`}
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
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1" data-testid="error-password">
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label htmlFor="confirm-password" className="block text-sm font-medium text-zinc-600">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }}
                    placeholder="Re-enter your password"
                    data-testid="input-confirm-password"
                    className={`w-full h-11 px-3.5 pr-10 rounded-xl border bg-white text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#818cf8] focus:border-transparent transition-all ${
                      errors.confirmPassword ? "border-red-400" : "border-gray-200"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    data-testid="btn-toggle-confirm"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1" data-testid="error-confirm-password">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isPending}
                data-testid="btn-submit-first-connection"
                className="w-full h-11 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 mt-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#4338ca]"
                style={{ background: "#4f46e5" }}
              >
                {isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Setting password…
                  </>
                ) : (
                  <>
                    Set password
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <Link href="/signin">
              <button
                data-testid="btn-back-signin"
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 font-medium"
              >
                <ArrowLeft className="w-3 h-3" /> Back to Sign In
              </button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
