import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock, Shield, ServerCog, Sparkles, Copy, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [registeredKeys, setRegisteredKeys] = useState<{ firm_name: string, firm_key: string, admin_key: string } | null>(null);

  const activateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData);

    try {
      const res = await fetch("/api/v1/auth/activate-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_key: data.admin_key, email: data.email, password: data.password, icai_membership_number: data.icai || null })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Activation failed");
      }
      const json = await res.json();
      localStorage.setItem("access_token", json.data.access_token);
      toast.success("Admin activated successfully");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const joinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData);

    try {
      const signupRes = await fetch("/api/v1/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password, icai_membership_number: data.icai || null })
      });
      if (!signupRes.ok) {
        const err = await signupRes.json();
        if (err.detail !== "Email already registered") {
          throw new Error(err.detail || "Signup failed");
        }
      }

      let token = "";
      if (signupRes.ok) {
        const signupJson = await signupRes.json();
        token = signupJson.data.access_token;
      } else {
        const loginRes = await fetch("/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: data.email, password: data.password })
        });
        if (!loginRes.ok) throw new Error("Invalid credentials for existing user");
        const loginJson = await loginRes.json();
        token = loginJson.data.access_token;
      }

      localStorage.setItem("access_token", token);

      const joinRes = await fetch("/api/v1/auth/join-firm", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ firm_key: data.firm_key, assigned_role: data.role })
      });
      if (!joinRes.ok) {
        const err = await joinRes.json();
        throw new Error(err.detail || "Failed to join firm");
      }
      toast.success("Join request submitted. Pending admin approval.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

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
      navigate("/dashboard");
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
        body: JSON.stringify({ email: "admin@firm.com", password: "temp", firm_name: data.firmName })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Registration failed");
      }
      const json = await res.json();
      setRegisteredKeys({
        firm_name: json.data.firm_name,
        firm_key: json.data.firm_key,
        admin_key: json.data.admin_key
      });
      toast.success("Firm keys generated successfully");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "123456789-placeholder.apps.googleusercontent.com"}>
      <div className="dark relative min-h-screen overflow-hidden bg-background text-foreground">
        <div className="relative grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex xl:p-14">
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
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage: "radial-gradient(circle, hsl(0 0% 100%) 0.6px, transparent 1px)",
                backgroundSize: "5px 5px",
              }}
            />
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
              <path d="M0,180 C260,60 460,260 720,140 C920,50 1080,200 1200,120 L1200,260 L0,260 Z" fill="url(#wave-grad)" opacity="0.55" />
              <path d="M0,210 C220,140 480,280 760,180 C960,110 1100,220 1200,170 L1200,260 L0,260 Z" fill="url(#wave-grad)" opacity="0.35" />
            </svg>

            <div className="relative">
              <Logo size="lg" />
            </div>

            <div className="relative space-y-8 max-w-xl">
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85 backdrop-blur">
                  <Sparkles className="h-3 w-3" strokeWidth={2} />
                  100% on-premise · zero data leaves your firm
                </div>
                <h1 className="font-display text-balance text-5xl font-semibold leading-[1.02] tracking-tight text-white xl:text-[58px]">
                  The intelligent workspace for <span className="text-aurora">chartered accountants.</span>
                </h1>
                <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-white/75">
                  Extract, reconcile, and audit financial documents with a private AI that runs on your firm's own server. No cloud uploads. No client data shared.
                </p>
              </div>

              <div className="grid gap-3">
                {[
                  { icon: Lock, title: "Client confidentiality, by design", desc: "Documents never leave your infrastructure." },
                  { icon: ServerCog, title: "Powered by local Gemma 4:e2b", desc: "Air-gapped Ollama runtime, no API calls." },
                  { icon: Shield, title: "Built for ICAI compliance", desc: "Audit trails, role-based access, retention." },
                ].map((f) => (
                  <div key={f.title} className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-all hover:border-white/25 hover:bg-white/8">
                    <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/5">
                      <span aria-hidden className="absolute inset-0 rounded-xl opacity-70" style={{ background: "radial-gradient(circle at 30% 30%, hsl(var(--aurora-2) / 0.7), transparent 60%), radial-gradient(circle at 70% 70%, hsl(var(--aurora-1) / 0.6), transparent 60%)" }} />
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
              © 2026 Quantive · Built for ICAI-registered firms in India
            </div>
          </div>

          <div className="relative flex items-center justify-center p-6 sm:p-10">
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50 lg:hidden" style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, hsl(var(--aurora-1) / 0.4), transparent 60%), radial-gradient(ellipse 60% 40% at 50% 100%, hsl(var(--aurora-2) / 0.3), transparent 60%)", filter: "blur(60px)" }} />
            <Card className="relative w-full max-w-md overflow-hidden rounded-2xl border-white/10 bg-card/70 p-8 shadow-elevated backdrop-blur-2xl sm:p-10">
              <div aria-hidden className="pointer-events-none absolute -inset-px rounded-2xl opacity-50" style={{ background: "var(--gradient-aurora)", WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)", WebkitMaskComposite: "xor", padding: "1px" }} />
              <div className="relative">
                <div className="mb-6 flex items-center gap-2 lg:hidden">
                  <Logo size="lg" />
                </div>

                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 rounded-full border border-border/60 bg-muted/40 p-1">
                    <TabsTrigger value="login" className="rounded-full text-[11px] data-[state=active]:bg-card data-[state=active]:shadow-sm">Login</TabsTrigger>
                    <TabsTrigger value="join" className="rounded-full text-[11px] data-[state=active]:bg-card data-[state=active]:shadow-sm">Join</TabsTrigger>
                    <TabsTrigger value="activate" className="rounded-full text-[11px] data-[state=active]:bg-card data-[state=active]:shadow-sm">Activate</TabsTrigger>
                    <TabsTrigger value="register" className="rounded-full text-[11px] data-[state=active]:bg-card data-[state=active]:shadow-sm">New Firm</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="mt-7 space-y-5">
                    <div>
                      <h2 className="font-display text-2xl font-semibold tracking-tight">Welcome back</h2>
                      <p className="mt-1 text-sm text-muted-foreground">Sign in to your firm's workspace.</p>
                    </div>
                    <form onSubmit={loginSubmit} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="email">Work email</Label>
                        <Input id="email" name="email" type="email" placeholder="anjali@mehtaco.in" required className="h-11 rounded-xl bg-background/60" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" name="password" type="password" placeholder="••••••••" required className="h-11 rounded-xl bg-background/60" />
                      </div>
                      <Button type="submit" disabled={loading} className="relative h-11 w-full overflow-hidden rounded-xl bg-gradient-aurora font-semibold text-white shadow-glow transition-transform hover:scale-[1.01]">
                        {loading ? "Signing in…" : "Sign in"}
                      </Button>
                    </form>
                    <div className="flex justify-center w-full mt-4">
                      <GoogleLogin
                        onSuccess={async (credentialResponse) => {
                          setLoading(true);
                          try {
                            const res = await fetch("/api/v1/auth/google", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ token: credentialResponse.credential })
                            });
                            if (!res.ok) {
                              const err = await res.json();
                              throw new Error(err.detail || "Google Login failed");
                            }
                            const json = await res.json();
                            localStorage.setItem("access_token", json.data.access_token);
                            toast.success("Login successful");
                            navigate("/dashboard");
                          } catch (err: any) {
                            toast.error(err.message);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        onError={() => toast.error("Google Login Failed")}
                        theme="filled_black" text="continue_with"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="join" className="mt-7 space-y-5">
                    <div>
                      <h2 className="font-display text-2xl font-semibold tracking-tight">Join your Firm</h2>
                      <p className="mt-1 text-sm text-muted-foreground">Enter your Firm Key to join an existing workspace.</p>
                    </div>
                    <form onSubmit={joinSubmit} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="firm_key">Firm Key</Label>
                        <Input id="firm_key" name="firm_key" placeholder="FRN-XXXXXXXX" required className="h-11 font-mono rounded-xl bg-background/60" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="role">Your Role</Label>
                        <select id="role" name="role" required className="flex h-11 w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                          <option value="Staff">Staff</option>
                          <option value="Partner">Partner</option>
                          <option value="Article Clerk">Article Clerk</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="jemail">Work email</Label>
                          <Input id="jemail" name="email" type="email" placeholder="you@firm.in" required className="h-11 rounded-xl bg-background/60" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="jicai">ICAI No. (optional)</Label>
                          <Input id="jicai" name="icai" placeholder="123456" className="h-11 rounded-xl bg-background/60" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="jpassword">Password</Label>
                        <Input id="jpassword" name="password" type="password" placeholder="At least 8 characters" required className="h-11 rounded-xl bg-background/60" />
                      </div>
                      <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl bg-gradient-aurora font-semibold text-white shadow-glow transition-transform hover:scale-[1.01]">
                        {loading ? "Joining…" : "Join Firm"}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="activate" className="mt-7 space-y-5">
                    <div>
                      <h2 className="font-display text-2xl font-semibold tracking-tight">Activate Admin</h2>
                      <p className="mt-1 text-sm text-muted-foreground">Use your One-Time Admin Key to set up your account.</p>
                    </div>
                    <form onSubmit={activateSubmit} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="admin_key">One-Time Admin Key</Label>
                        <Input id="admin_key" name="admin_key" type="password" required className="h-11 font-mono rounded-xl bg-background/60" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="aemail">Admin email</Label>
                          <Input id="aemail" name="email" type="email" placeholder="admin@firm.in" required className="h-11 rounded-xl bg-background/60" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="aicai">ICAI No.</Label>
                          <Input id="aicai" name="icai" placeholder="123456" required className="h-11 rounded-xl bg-background/60" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="apassword">Password</Label>
                        <Input id="apassword" name="password" type="password" required className="h-11 rounded-xl bg-background/60" />
                      </div>
                      <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl bg-gradient-aurora font-semibold text-white shadow-glow transition-transform hover:scale-[1.01]">
                        {loading ? "Activating…" : "Activate Admin"}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="register" className="mt-7 space-y-5">
                    {registeredKeys ? (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div>
                          <h2 className="font-display text-2xl font-semibold tracking-tight text-success">Firm Registered!</h2>
                          <p className="mt-1 text-sm text-muted-foreground">Please save these keys securely. The Admin Key will only be shown once.</p>
                        </div>

                        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-4">
                          <div>
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Firm Key (Share with Staff)</Label>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 bg-background px-3 py-2 rounded-lg border font-mono text-sm">{registeredKeys.firm_key}</code>
                              <Button size="icon" variant="outline" onClick={() => copyToClipboard(registeredKeys.firm_key, 'Firm Key')}><Copy className="h-4 w-4" /></Button>
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs uppercase tracking-wider text-destructive mb-1 block flex items-center gap-1"><Key className="h-3 w-3" /> One-Time Admin Key</Label>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 bg-background px-3 py-2 rounded-lg border font-mono text-sm break-all">{registeredKeys.admin_key}</code>
                              <Button size="icon" variant="outline" onClick={() => copyToClipboard(registeredKeys.admin_key, 'Admin Key')}><Copy className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        </div>

                        <Button onClick={() => setRegisteredKeys(null)} variant="outline" className="w-full h-11 rounded-xl">Back to Start</Button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <h2 className="font-display text-2xl font-semibold tracking-tight">Generate Keys</h2>
                          <p className="mt-1 text-sm text-muted-foreground">Register your firm to generate your Firm Key and One-Time Admin Key.</p>
                        </div>
                        <form onSubmit={registerSubmit} className="space-y-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="firmName">Firm name</Label>
                            <Input id="firmName" name="firmName" placeholder="Mehta &amp; Co." required className="h-11 rounded-xl bg-background/60" />
                          </div>
                          <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl bg-gradient-aurora font-semibold text-white shadow-glow transition-transform hover:scale-[1.01]">
                            {loading ? "Generating…" : "Generate Keys"}
                          </Button>
                        </form>
                      </>
                    )}
                  </TabsContent>
                </Tabs>

                <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
                  By continuing you agree to our Terms and confirm you are an ICAI-registered practitioner.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
