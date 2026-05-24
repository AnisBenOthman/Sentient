import React, { useState } from "react";
import { Cpu, ArrowRight, ArrowLeft } from "lucide-react";
import "./_circuitbloom.css";

export function CenteredMinimal() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Sign in with", email, password);
  };

  return (
    <div className="circuit-bloom-bg font-sans text-slate-900">
      {/* Decorative Blobs */}
      <svg
        className="absolute bottom-0 right-0 pointer-events-none blob-1"
        style={{ width: "520px", height: "420px", transformOrigin: "center", opacity: 0.3 }}
        viewBox="0 0 520 420"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M480 150C520 220 540 330 450 390C360 450 200 420 100 350C0 280 -20 150 30 80C80 10 200 -30 310 20C420 70 440 80 480 150Z"
          fill="#fb7185"
        />
      </svg>

      <svg
        className="absolute top-1/4 -left-20 pointer-events-none blob-2"
        style={{ width: "300px", height: "500px", transformOrigin: "center", opacity: 0.25 }}
        viewBox="0 0 300 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M250 100C300 200 280 350 200 450C120 550 20 480 0 380C-20 280 10 150 80 50C150 -50 200 0 250 100Z"
          fill="#38bdf8"
        />
      </svg>

      <svg
        className="absolute top-0 right-32 pointer-events-none blob-3"
        style={{ width: "220px", height: "200px", transformOrigin: "center", opacity: 0.2 }}
        viewBox="0 0 220 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M180 50C210 90 230 140 190 180C150 220 80 200 40 160C0 120 -10 60 20 30C50 0 150 10 180 50Z"
          fill="#a78bfa"
        />
      </svg>

      {/* Floating Ring Accents */}
      <div className="absolute top-40 left-40 ring-accent pointer-events-none w-16 h-16 rounded-full border-2 border-violet-400 opacity-15"></div>
      <div className="absolute bottom-60 left-1/4 ring-accent pointer-events-none w-24 h-24 rounded-full border-2 border-coral-400 opacity-15" style={{ borderColor: "#fb7185" }}></div>
      <div className="absolute top-1/3 right-1/4 ring-accent pointer-events-none w-10 h-10 rounded-full border-2 border-sky-400 opacity-15" style={{ borderColor: "#38bdf8" }}></div>

      {/* Pixel AI chip decoration */}
      <img
        src="/__mockup/images/ai-chip.png"
        alt="AI Chip"
        className="pointer-events-none absolute"
        style={{
          bottom: "24px",
          right: "24px",
          width: "64px",
          opacity: 0.4,
          imageRendering: "pixelated",
        }}
      />

      {/* Login Card */}
      <div
        className="relative z-10 bg-white w-full max-w-[400px] flex flex-col items-center"
        style={{
          borderRadius: "24px",
          boxShadow: "0 12px 60px rgba(124, 58, 237, 0.1)",
          padding: "44px",
        }}
      >
        {/* Logo Area */}
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: "#ede9fe" }}>
          <Cpu className="w-8 h-8 text-violet-600" style={{ color: "#7c3aed" }} />
        </div>

        <h1 className="text-2xl font-bold mb-2 text-center" style={{ color: "#1e1b4b" }}>
          Sentient HRIS
        </h1>
        <p className="mb-8 text-center text-sm" style={{ color: "#c4b5fd" }}>
          Sign in to your workspace
        </p>

        <form className="w-full space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5 flex flex-col text-left">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-violet-100 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-shadow"
              placeholder="name@company.com"
              required
            />
          </div>

          <div className="space-y-1.5 flex flex-col text-left">
            <div className="flex items-center justify-between ml-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Password
              </label>
              <a href="#" className="text-xs font-medium text-violet-500 hover:text-violet-700 transition-colors">
                Forgot password?
              </a>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-violet-100 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-shadow"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 mt-6 flex items-center justify-center gap-2 text-white font-medium shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #fb7185 0%, #8b5cf6 100%)",
              borderRadius: "12px",
            }}
          >
            Sign In <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-8 flex justify-center w-full pt-4">
          <a
            href="/"
            className="flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: "#a78bfa" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </a>
        </div>
      </div>
    </div>
  );
}

export default CenteredMinimal;
