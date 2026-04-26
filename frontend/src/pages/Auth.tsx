import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock, Shield, ServerCog, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/logo";

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const loginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData);
    
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Login failed");
      }
      const json = await res.json();
      localStorage.setItem("access_token", json.data.access_token);
      toast.success("Login successful");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const registerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData);
    
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.remail, password: data.rpassword, firm_name: data.firmName })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Registration failed");
      }
      const json = await res.json();
      localStorage.setItem("access_token", json.data.access_token);
      toast.success("Firm registered successfully");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dark relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="relative grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left — aurora hero */}
        <div className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex xl:p-14">
          {/* Aurora wash — multiple soft orbs */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-20"
            style={{
              background:
                "radial-gradient(ellipse 50% 40% at 25% 30%, hsl(var(--aurora-1) / 0.65), transparent 60%), radial-gradient(ellipse 45% 35% at 75% 25%, hsl(var(--aurora-2) / 0.65), transparent 60%), radial-gradient(ellipse 40% 30% at 60% 75%, hsl(var(--aurora-3) / 0.55), transparent 60%), radial-gradient(ellipse 35% 30% at 25% 80%, hsl(var(--aurora-4) / 0.55), transparent 60%)",
              filter: "blur(70px) saturate(170%)",
              animation: "aurora-drift 24s ease-in-out infinite alternate",
            }}
          />
          {/* Star field */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: "radial-gradient(circle, hsl(0 0% 100%) 0.6px, transparent 1px)",
              backgroundSize: "5px 5px",
            }}
          />
          {/* Wave (EXHIBITION poster reference) */}
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[260px] w-full opacity-80 mix-blend-screen"
            viewBox="0 0 1200 260"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="wave-grad" x1="0" x2="1" y1="0.5" y2="0.5">
                <stop offset="0%" stopColor="hsl(258 88% 60%)" />
                <stop offset="35%" stopColor="hsl(280 70% 55%)" />
                <stop offset="60%" stopColor="hsl(198 92% 60%)" />
                <stop offset="85%" stopColor="hsl(28 96% 60%)" />
                <stop offset="100%" stopColor="hsl(322 78% 60%)" />
              </linearGradient>
            </defs>
            <path
              d="M0,180 C260,60 460,260 720,140 C920,50 1080,200 1200,120 L1200,260 L0,260 Z"
              fill="url(#wave-grad)"
              opacity="0.55"
            />
            <path
              d="M0,210 C220,140 480,280 760,180 C960,110 1100,220 1200,170 L1200,260 L0,260 Z"
              fill="url(#wave-grad)"
              opacity="0.35"
            />
          </svg>

          <div className="relative">
            <Logo />
          </div>

          <div className="relative space-y-8 max-w-xl">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85 backdrop-blur">
                <Sparkles className="h-3 w-3" strokeWidth={2} />
                100% on-premise · zero data leaves your firm
              </div>
              <h1 className="font-display text-balance text-5xl font-semibold leading-[1.02] tracking-tight text-white xl:text-[58px]">
                The intelligent workspace for{" "}
                <span className="text-aurora">chartered accountants.</span>
              </h1>
              <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-white/75">
                Extract, reconcile, and audit financial documents with a private
                AI that runs on your firm's own server. No cloud uploads. No
                client data shared.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                { icon: Lock, title: "Client confidentiality, by design", desc: "Documents never leave your infrastructure." },
                { icon: ServerCog, title: "Powered by local Gemma 2", desc: "Air-gapped Ollama runtime, no API calls." },
                { icon: Shield, title: "Built for ICAI compliance", desc: "Audit trails, role-based access, retention." },
              ].map((f) => (
                <div
                  key={f.title}
                  className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-all hover:border-white/25 hover:bg-white/8"
                >
                  <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/5">
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-xl opacity-70"
                      style={{
                        background:
                          "radial-gradient(circle at 30% 30%, hsl(var(--aurora-2) / 0.7), transparent 60%), radial-gradient(circle at 70% 70%, hsl(var(--aurora-1) / 0.6), transparent 60%)",
                      }}
                    />
                    <f.icon className="relative h-4 w-4 text-white" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-white">{f.title}</p>
                    <p className="mt-0.5 text-[12px] text-white/65">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative text-[12px] text-white/55">
            © 2026 CA Intelligence · Built for ICAI-registered firms in India
          </div>
        </div>

        {/* Right — auth form */}
        <div className="relative flex items-center justify-center p-6 sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-50 lg:hidden"
            style={{
              background:
                "radial-gradient(ellipse 60% 40% at 50% 0%, hsl(var(--aurora-1) / 0.4), transparent 60%), radial-gradient(ellipse 60% 40% at 50% 100%, hsl(var(--aurora-2) / 0.3), transparent 60%)",
              filter: "blur(60px)",
            }}
          />
          <Card className="relative w-full max-w-md overflow-hidden rounded-2xl border-white/10 bg-card/70 p-8 shadow-elevated backdrop-blur-2xl sm:p-10">
            {/* Card aurora rim */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-px rounded-2xl opacity-50"
              style={{
                background: "var(--gradient-aurora)",
                WebkitMask:
                  "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                WebkitMaskComposite: "xor",
                padding: "1px",
              }}
            />
            <div className="relative">
              <div className="mb-6 flex items-center gap-2 lg:hidden">
                <Logo />
              </div>

              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 rounded-full border border-border/60 bg-muted/40 p-1">
                  <TabsTrigger value="login" className="rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm">Sign in</TabsTrigger>
                  <TabsTrigger value="register" className="rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm">Register firm</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-7 space-y-5">
                  <div>
                    <h2 className="font-display text-2xl font-semibold tracking-tight">Welcome back</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Sign in to your firm's workspace.
                    </p>
                  </div>

                  <form onSubmit={loginSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Work email</Label>
                      <Input id="email" name="email" type="email" placeholder="anjali@mehtaco.in" defaultValue="anjali@mehtaco.in" required className="h-11 rounded-xl bg-background/60" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <button type="button" className="text-xs font-medium text-primary hover:underline">
                          Forgot?
                        </button>
                      </div>
                      <Input id="password" name="password" type="password" placeholder="••••••••" defaultValue="demo1234" required className="h-11 rounded-xl bg-background/60" />
                    </div>
                    <Button type="submit" disabled={loading} className="relative h-11 w-full overflow-hidden rounded-xl bg-gradient-aurora font-semibold text-white shadow-glow transition-transform hover:scale-[1.01]">
                      {loading ? "Signing in…" : "Sign in to workspace"}
                    </Button>
                  </form>

                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">or</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <Button variant="outline" className="h-11 w-full rounded-xl bg-background/40 font-medium backdrop-blur">
                    Continue with SSO (Google Workspace)
                  </Button>
                </TabsContent>

                <TabsContent value="register" className="mt-7 space-y-5">
                  <div>
                    <h2 className="font-display text-2xl font-semibold tracking-tight">Set up your firm</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Create your private workspace in under 60 seconds.
                    </p>
                  </div>
                  <form onSubmit={registerSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="firmName">Firm name</Label>
                      <Input id="firmName" name="firmName" placeholder="Mehta &amp; Co." required className="h-11 rounded-xl bg-background/60" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="rname">Your name</Label>
                        <Input id="rname" name="rname" placeholder="CA Anjali Mehta" required className="h-11 rounded-xl bg-background/60" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="icai">ICAI No.</Label>
                        <Input id="icai" name="icai" placeholder="123456" required className="h-11 rounded-xl bg-background/60" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="remail">Work email</Label>
                      <Input id="remail" name="remail" type="email" placeholder="you@firm.in" required className="h-11 rounded-xl bg-background/60" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="rpassword">Password</Label>
                      <Input id="rpassword" name="rpassword" type="password" placeholder="At least 8 characters" required className="h-11 rounded-xl bg-background/60" />
                    </div>
                    <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl bg-gradient-aurora font-semibold text-white shadow-glow transition-transform hover:scale-[1.01]">
                      {loading ? "Creating workspace…" : "Create workspace"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
                By continuing you agree to our Terms and confirm you are an
                ICAI-registered practitioner.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
