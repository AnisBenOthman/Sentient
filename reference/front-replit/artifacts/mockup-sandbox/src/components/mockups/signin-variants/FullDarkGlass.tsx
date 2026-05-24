import React, { useState } from "react";
import { Brain, ArrowRight, ArrowLeft } from "lucide-react";
import "./_datagarden.css";

export function FullDarkGlass() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="flex min-h-[100dvh] w-full bg-white font-sans overflow-hidden">
      {/* Left Panel */}
      <div className="relative hidden lg:flex w-[55%] bg-[#f0f4ff] flex-col justify-end p-12 overflow-hidden">
        {/* SVG Blobs & Lines */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {/* Lines */}
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <line x1="30%" y1="40%" x2="60%" y2="30%" stroke="#6366f1" strokeWidth="1" opacity="0.15" />
            <line x1="30%" y1="40%" x2="50%" y2="70%" stroke="#6366f1" strokeWidth="1" opacity="0.15" />
            <line x1="60%" y1="30%" x2="50%" y2="70%" stroke="#6366f1" strokeWidth="1" opacity="0.15" />
          </svg>
          
          {/* Large Teal Blob */}
          <div className="absolute top-[20%] left-[10%] datagarden-blob" style={{ animationDelay: '0s' }}>
            <svg width="450" height="380" viewBox="0 0 450 380" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.35 }}>
              <path d="M380.5 140.5C410.5 190.5 460.5 250.5 420.5 310.5C380.5 370.5 250.5 390.5 160.5 360.5C70.5 330.5 20.5 250.5 5.5 170.5C-9.5 90.5 40.5 10.5 110.5 1.5C180.5 -7.5 350.5 90.5 380.5 140.5Z" fill="#0d9488"/>
            </svg>
          </div>

          {/* Medium Indigo Blob */}
          <div className="absolute top-[10%] left-[40%] datagarden-blob" style={{ animationDelay: '-5s' }}>
            <svg width="320" height="280" viewBox="0 0 320 280" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.3 }}>
              <path d="M280.5 100.5C310.5 140.5 330.5 200.5 290.5 240.5C250.5 280.5 150.5 290.5 90.5 260.5C30.5 230.5 -10.5 160.5 2.5 100.5C15.5 40.5 80.5 -10.5 140.5 2.5C200.5 15.5 250.5 60.5 280.5 100.5Z" fill="#6366f1"/>
            </svg>
          </div>

          {/* Small Sky Blue Blob */}
          <div className="absolute top-[50%] left-[30%] datagarden-blob" style={{ animationDelay: '-10s' }}>
            <svg width="220" height="200" viewBox="0 0 220 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.25 }}>
              <path d="M190.5 70.5C210.5 100.5 230.5 140.5 200.5 170.5C170.5 200.5 110.5 210.5 60.5 190.5C10.5 170.5 -10.5 120.5 4.5 70.5C19.5 20.5 70.5 -10.5 110.5 2.5C150.5 15.5 170.5 40.5 190.5 70.5Z" fill="#38bdf8"/>
            </svg>
          </div>
        </div>

        {/* AI Chip */}
        <img 
          src="/__mockup/images/ai-chip.png" 
          alt=""
          className="absolute z-10"
          style={{ bottom: '32px', left: '32px', width: '56px', opacity: 0.5, imageRendering: 'pixelated' }} 
        />

        {/* Text */}
        <div className="relative z-10 ml-[88px] mb-2">
          <h2 className="text-indigo-900 font-semibold text-lg mb-3">Intelligent HR for modern teams</h2>
          <div className="space-y-1">
            <p className="text-indigo-500 text-sm">• AI-powered insights</p>
            <p className="text-indigo-500 text-sm">• Smart leave management</p>
            <p className="text-indigo-500 text-sm">• Real-time org charts</p>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-[45%] bg-white flex flex-col items-center justify-center p-8 relative">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-14 h-14 bg-teal-50 rounded-full flex items-center justify-center mb-4">
              <Brain className="w-7 h-7 text-teal-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Sentient HRIS</h1>
            <p className="text-slate-400">Welcome back. Please enter your details.</p>
          </div>

          <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 block text-left">Email address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email" 
                className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 block text-left">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500" />
                <span className="text-gray-600">Remember for 30 days</span>
              </label>
              <a href="/" className="text-teal-600 hover:text-teal-700 font-medium">Forgot password?</a>
            </div>

            <button 
              type="submit" 
              className="w-full bg-[#0d9488] hover:bg-teal-700 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors mt-2"
            >
              Sign In <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="text-center mt-8 text-sm text-gray-600">
            Don't have an account? <a href="/" className="text-teal-600 hover:text-teal-700 font-medium">Sign up</a>
          </p>
        </div>

        <a href="/" className="absolute bottom-8 text-slate-400 hover:text-slate-600 text-sm flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </a>
      </div>
    </div>
  );
}