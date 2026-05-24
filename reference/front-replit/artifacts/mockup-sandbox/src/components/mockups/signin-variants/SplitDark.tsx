import React from "react";
import { Brain, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import "./_softneural.css";

export function SplitDark() {
  return (
    <div className="relative min-h-[100dvh] w-full bg-[#faf8f5] flex items-center justify-center overflow-hidden font-sans">

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

      {/* Login Card */}
      <div
        className="relative z-10 bg-white rounded-[20px] p-10 w-full max-w-[420px] flex flex-col items-center mx-4"
        style={{ boxShadow: "0 8px 40px rgba(99,102,241,0.12)" }}
      >
        <div className="w-12 h-12 rounded-full bg-[#eef2ff] flex items-center justify-center mb-6">
          <Brain className="w-6 h-6 text-[#4f46e5]" />
        </div>

        <h1 className="text-[24px] font-bold text-[#1e1b4b] mb-2">Sentient HRIS</h1>
        <p className="text-slate-400 mb-8 text-center">Sign in to your workspace</p>

        <form className="w-full space-y-4 mb-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-700">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              className="bg-white border-gray-200 focus-visible:ring-[#818cf8] focus-visible:border-[#818cf8]"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-slate-700">Password</Label>
              <a href="#" className="text-sm text-[#4f46e5] hover:underline">Forgot password?</a>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              className="bg-white border-gray-200 focus-visible:ring-[#818cf8] focus-visible:border-[#818cf8]"
            />
          </div>

          <Button className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl h-11 mt-4 group">
            Sign In
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </form>

        <a href="/" className="text-slate-400 hover:text-slate-600 text-sm flex items-center transition-colors">
          <ArrowLeft className="w-3 h-3 mr-1" />
          Back to home
        </a>
      </div>

    </div>
  );
}
