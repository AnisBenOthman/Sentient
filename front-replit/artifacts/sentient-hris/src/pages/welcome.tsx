import { Link } from "wouter";
import { useState } from "react";
import "./welcome.css";
import {
  Brain,
  Users,
  BarChart3,
  Shield,
  Clock,
  Sparkles,
  ArrowRight,
  ChevronDown,
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI-Powered Insights",
    description:
      "Predictive analytics surface workforce trends before they become problems. Know who's at risk of leaving before they decide.",
  },
  {
    icon: Users,
    title: "Employee Lifecycle",
    description:
      "From offer letter to offboarding, every milestone tracked in one place. Onboarding checklists, document storage, org chart — all connected.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    description:
      "Headcount, attrition, leave patterns, compensation bands — live dashboards built for HR decisions, not data exports.",
  },
  {
    icon: Shield,
    title: "Enterprise Compliance",
    description:
      "Built-in labor law compliance across jurisdictions. Audit trails, role-based access, and SOC 2 Type II certified.",
  },
  {
    icon: Clock,
    title: "Leave & Attendance",
    description:
      "Automated leave policies, team calendars, conflict detection, and payroll sync. No more spreadsheets.",
  },
  {
    icon: Sparkles,
    title: "AI HR Assistant",
    description:
      "Ask anything in plain language — headcount by department, who's on leave next week, average tenure by role. Instant answers.",
  },
];

const stats = [
  { value: "127+", label: "Employees managed" },
  { value: "99.9%", label: "Platform uptime" },
  { value: "< 30s", label: "Avg onboarding time" },
  { value: "SOC 2", label: "Certified" },
];

const testimonials = [
  {
    quote:
      "Sentient replaced four separate tools we were using. The AI assistant alone saves our HR team two hours a day.",
    name: "Eleanor Vance",
    role: "VP of Engineering",
    initials: "EV",
  },
  {
    quote:
      "The leave management alone was worth the switch. No more chasing approvals over email.",
    name: "Michael Realman",
    role: "Head of HR",
    initials: "MR",
  },
  {
    quote:
      "Finally an HRIS that doesn't feel like it was built in 2005. The analytics are genuinely useful.",
    name: "Simone Garnett",
    role: "VP of Product",
    initials: "SG",
  },
];

export default function Welcome() {
  const [moreInfoOpen, setMoreInfoOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5" data-testid="logo">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm">
              <Brain className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-base tracking-tight">Sentient HRIS</span>
          </div>
          <nav className="flex items-center gap-3">
            <button
              data-testid="btn-more-info-nav"
              onClick={() => {
                setMoreInfoOpen(true);
                const el = document.getElementById("features");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-accent"
            >
              Features
            </button>
            <Link href="/signin">
              <button
                data-testid="btn-signin-nav"
                className="text-sm font-medium px-4 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Sign In
              </button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-8"
            data-testid="hero-badge"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered HR Platform
          </div>
          <h1
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.08]"
            data-testid="hero-headline"
          >
            The HR platform
            <br />
            <span className="text-primary">that actually thinks.</span>
          </h1>
          <p
            className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed"
            data-testid="hero-subtext"
          >
            Sentient HRIS combines AI with modern people management — so you spend less time on
            admin and more time on your team. Built for organizations that move fast.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/signin">
              <button
                data-testid="btn-get-started-hero"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 rounded-lg font-semibold text-base hover:opacity-90 transition-opacity shadow-md"
              >
                Sign In
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <button
              data-testid="btn-more-info-hero"
              onClick={() => {
                setMoreInfoOpen(true);
                const el = document.getElementById("features");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg font-semibold text-base border border-border hover:bg-accent transition-colors"
            >
              More Info
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Logo ticker */}
      <section className="py-12 border-y border-border/50 overflow-hidden bg-background">
        <p className="text-center text-sm font-semibold text-muted-foreground mb-8 px-4">
          Trusted by leading teams worldwide
        </p>
        <div className="relative">
          <div
            className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
            style={{ background: "linear-gradient(to right, hsl(var(--background)), transparent)" }}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
            style={{ background: "linear-gradient(to left, hsl(var(--background)), transparent)" }}
          />
          <div className="marquee-track">
            {[
              "sweetgreen", "Acumatica", "PVH", "Reformation", "1Password",
              "YipitData", "Airbnb", "Headspace", "Scout", "Life360", "LTK", "Zip", "Mitsubishi",
              "sweetgreen", "Acumatica", "PVH", "Reformation", "1Password",
              "YipitData", "Airbnb", "Headspace", "Scout", "Life360", "LTK", "Zip", "Mitsubishi",
            ].map((name, i) => (
              <span
                key={i}
                className="inline-flex items-center px-8 text-[15px] font-semibold tracking-tight text-foreground/30 whitespace-nowrap select-none"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center" data-testid={`stat-${s.label.replace(/\s+/g, "-").toLowerCase()}`}>
              <div className="text-3xl font-bold text-primary mb-1">{s.value}</div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="features-heading">
              Everything HR needs, nothing it doesn't
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Six core modules built to work together, powered by AI throughout.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="bg-card border border-border rounded-xl p-6 hover:border-primary/40 hover:shadow-sm transition-all"
                  data-testid={`feature-card-${f.title.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-base mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 border-t border-border bg-card/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12" data-testid="testimonials-heading">
            Trusted by teams who care about their people
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="bg-card border border-border rounded-xl p-6"
                data-testid={`testimonial-${t.initials.toLowerCase()}`}
              >
                <p className="text-sm leading-relaxed mb-5 text-foreground/80">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Bottom */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="cta-heading">
            Ready to modernize your HR?
          </h2>
          <p className="text-muted-foreground mb-10">
            Join forward-thinking HR teams already using Sentient to manage their people smarter.
          </p>
          <div className="flex justify-center">
            <Link href="/signin">
              <button
                data-testid="btn-signin-bottom"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                Sign In
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-primary rounded flex items-center justify-center">
              <Brain className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-medium text-foreground">Sentient HRIS</span>
            <span>© 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/signin">
              <span className="hover:text-foreground transition-colors cursor-pointer">Sign In</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
