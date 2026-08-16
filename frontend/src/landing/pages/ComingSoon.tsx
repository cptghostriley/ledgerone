import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/logo";

export default function ComingSoon() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between overflow-x-hidden selection:bg-indigo-500 selection:text-white font-sans">
      {/* ── Header ───────────────────────────────────────────── */}
      <header className="w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8 text-indigo-400 font-serif italic text-2xl" />
            <span className="font-serif-display text-xl font-bold tracking-tight text-white">Quantive</span>
          </Link>
          <Button asChild variant="ghost" size="sm" className="text-slate-300 hover:text-white text-xs font-semibold hover:bg-white/10">
            <Link to="/" className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
            </Link>
          </Button>
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────────── */}
      <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        {/* Background Aurora Effect */}
        <div aria-hidden className="pointer-events-none absolute -inset-20" style={{
          background: "radial-gradient(ellipse 50% 40% at 30% 40%, hsl(var(--aurora-1) / 0.40), transparent 60%), radial-gradient(ellipse 45% 35% at 70% 30%, hsl(var(--aurora-2) / 0.35), transparent 60%)",
          filter: "blur(80px) saturate(170%)",
          animation: "aurora-drift 24s ease-in-out infinite alternate",
        }} />

        {/* Dot grid texture */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.4) 0.65px, transparent 0)",
          backgroundSize: "8px 8px",
        }} />

        <div className="relative z-10 max-w-3xl mx-auto space-y-5 sm:space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-indigo-300 backdrop-blur-md"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            Private Beta Deployment
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="font-serif-display text-2xl sm:text-4xl md:text-6xl font-bold tracking-tight text-white leading-snug sm:leading-tight max-w-2xl mx-auto text-balance"
          >
            Quantive Workspace is{" "}
            <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-purple-300 font-normal">
              On-Boarding Select Firms.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15 }}
            className="text-xs sm:text-base leading-relaxed text-slate-300 max-w-lg mx-auto font-normal px-2"
          >
            We are rolling out our air-gapped practice operating system in waves for ICAI-registered Chartered Accountant firms. Enter your work email below to request early server setup.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.22 }}
            className="mt-6 sm:mt-8 max-w-md mx-auto w-full px-2"
          >
            {submitted ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center backdrop-blur-md">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-3" />
                <h3 className="font-serif-display text-lg font-bold text-white">Access Request Received</h3>
                <p className="text-xs text-slate-300 mt-1.5">
                  Our practice deployment team will reach out to <strong>{email}</strong> within 24 hours to schedule server installation.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5 w-full">
                <div className="relative flex-1">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="partner@yourfirm.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 sm:h-12 rounded-xl border border-white/15 bg-white/5 pl-10 pr-4 text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-md"
                  />
                </div>
                <Button type="submit" size="lg" className="h-11 sm:h-12 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-lg shrink-0 gap-2">
                  Request Access <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="pt-4 sm:pt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-6 text-xs text-slate-300 font-medium"
          >
            <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-emerald-400" /> Air-Gapped Local Server</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> ICAI Guidelines Compliant</span>
          </motion.div>
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-slate-950 py-8 text-center text-xs text-slate-400">
        <p>Contact: <a href="mailto:workstudiotwelve@gmail.com" className="text-white hover:text-indigo-400 transition-colors underline font-medium">workstudiotwelve@gmail.com</a></p>
        <p className="mt-2 text-[11px] text-slate-500">&copy; 2026 Quantive. All rights reserved.</p>
      </footer>
    </div>
  );
}
