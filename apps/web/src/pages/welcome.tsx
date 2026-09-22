import { Link } from "wouter";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
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
import type { LucideIcon } from "lucide-react";

/**
 * WHY ids and not the rendered title: the copy is translated, so anything
 * derived from it (React keys, data-testid) would change with the language.
 * These ids are the stable half — they key both the locale lookup and the
 * test hooks.
 */
const FEATURE_IDS = [
  "aiInsights",
  "lifecycle",
  "analytics",
  "compliance",
  "leave",
  "assistant",
] as const;

const FEATURE_ICONS: Record<(typeof FEATURE_IDS)[number], LucideIcon> = {
  aiInsights: Brain,
  lifecycle: Users,
  analytics: BarChart3,
  compliance: Shield,
  leave: Clock,
  assistant: Sparkles,
};

/** The figures are language-independent; only their labels are translated. */
const STATS = [
  { id: "employeesManaged", value: "127+" },
  { id: "uptime", value: "99.9%" },
  { id: "onboardingTime", value: "< 30s" },
  { id: "certified", value: "SOC 2" },
] as const;

const TESTIMONIAL_IDS = ["ev", "mr", "sg"] as const;

const TICKER_LOGOS = [
  "sweetgreen", "Acumatica", "PVH", "Reformation", "1Password",
  "YipitData", "Airbnb", "Headspace", "Scout", "Life360", "LTK", "Zip", "Mitsubishi",
];

export default function Welcome() {
  const { t } = useTranslation("auth");

  const features = useMemo(
    () =>
      FEATURE_IDS.map((id) => ({
        id,
        Icon: FEATURE_ICONS[id],
        title: t(`welcome.featuresList.${id}Title` as const),
        description: t(`welcome.featuresList.${id}Desc` as const),
      })),
    [t],
  );

  function scrollToFeatures(): void {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5" data-testid="logo">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm">
              <Brain className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-base tracking-tight">{t("appName")}</span>
          </div>
          <nav className="flex items-center gap-3">
            <button
              data-testid="btn-more-info-nav"
              onClick={scrollToFeatures}
              className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-accent"
            >
              {t("welcome.features")}
            </button>
            <Link href="/signin">
              <button
                data-testid="btn-signin-nav"
                className="text-sm font-medium px-4 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                {t("welcome.signIn")}
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
            {t("welcome.badge")}
          </div>
          <h1
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.08]"
            data-testid="hero-headline"
          >
            {t("welcome.heroHeadline1")}
            <br />
            <span className="text-primary">{t("welcome.heroHeadline2")}</span>
          </h1>
          <p
            className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed"
            data-testid="hero-subtext"
          >
            {t("welcome.heroSubtext")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/signin">
              <button
                data-testid="btn-get-started-hero"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 rounded-lg font-semibold text-base hover:opacity-90 transition-opacity shadow-md"
              >
                {t("welcome.signIn")}
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <button
              data-testid="btn-more-info-hero"
              onClick={scrollToFeatures}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg font-semibold text-base border border-border hover:bg-accent transition-colors"
            >
              {t("welcome.moreInfo")}
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Logo ticker */}
      <section className="py-12 border-y border-border/50 overflow-hidden bg-background">
        <p className="text-center text-sm font-semibold text-muted-foreground mb-8 px-4">
          {t("welcome.trustedBy")}
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
            {[...TICKER_LOGOS, ...TICKER_LOGOS].map((name, i) => (
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
          {STATS.map((s) => (
            <div key={s.id} className="text-center" data-testid={`stat-${s.id}`}>
              <div className="text-3xl font-bold text-primary mb-1">{s.value}</div>
              <div className="text-sm text-muted-foreground">{t(`welcome.stats.${s.id}` as const)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="features-heading">
              {t("welcome.featuresHeading")}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t("welcome.featuresSub")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ id, Icon, title, description }) => (
              <div
                key={id}
                className="bg-card border border-border rounded-xl p-6 hover:border-primary/40 hover:shadow-sm transition-all"
                data-testid={`feature-card-${id}`}
              >
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-base mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 border-t border-border bg-card/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12" data-testid="testimonials-heading">
            {t("welcome.testimonialsHeading")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIAL_IDS.map((id) => (
              <div
                key={id}
                className="bg-card border border-border rounded-xl p-6"
                data-testid={`testimonial-${id}`}
              >
                <p className="text-sm leading-relaxed mb-5 text-foreground/80">
                  &ldquo;{t(`welcome.testimonials.${id}Quote` as const)}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                    {id.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t(`welcome.testimonials.${id}Name` as const)}</div>
                    <div className="text-xs text-muted-foreground">{t(`welcome.testimonials.${id}Role` as const)}</div>
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
            {t("welcome.ctaHeading")}
          </h2>
          <p className="text-muted-foreground mb-10">{t("welcome.ctaSub")}</p>
          <div className="flex justify-center">
            <Link href="/signin">
              <button
                data-testid="btn-signin-bottom"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                {t("welcome.signIn")}
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
            <span className="font-medium text-foreground">{t("appName")}</span>
            <span>{t("welcome.copyright")}</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/signin">
              <span className="hover:text-foreground transition-colors cursor-pointer">
                {t("welcome.signIn")}
              </span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
