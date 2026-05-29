import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getCertifications } from "@/services/certifications";
import { getMyPoints } from "@/services/gamification";
import { getPlatformStats, type PlatformStats } from "@/services/analytics";
import { useNavigate, Link } from "react-router-dom";
import {
  Brain,
  Zap,
  BarChart3,
  Users,
  Target,
  BookOpen,
  Flame,
  Sparkles,
  Trophy,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Quote,
  Clock,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import CertificationCard from "@/components/CertificationCard";
import { CardSkeleton } from "@/components/PageSkeleton";
import { useAuthStore } from "@/stores/auth.store";
import { fallbackCertifications } from "@/data/fallbackCertifications";
import Navbar from "@/components/Navbar";

const formatStat = (value: number): string => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M+`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K+`;
  return value.toString();
};

const features = [
  {
    icon: Target,
    title: "Exam Simulation",
    desc: "Timer, navigation, mark for review — like real exams.",
  },
  {
    icon: BarChart3,
    title: "Smart Analytics",
    desc: "Domain breakdown, weak topic detection, pass probability.",
  },
  {
    icon: Users,
    title: "Community Driven",
    desc: "Create and share exams. Voting, reviews, verification.",
  },
  {
    icon: Zap,
    title: "AI Assist",
    desc: "Generate questions, improve explanations, detect duplicates.",
  },
  {
    icon: BookOpen,
    title: "Study Mode",
    desc: "Flashcards, instant feedback, adaptive learning.",
  },
  {
    icon: Brain,
    title: "Adaptive Exam",
    desc: "Right questions → harder. Wrong → easier.",
  },
];

const howItWorks = [
  {
    step: "01",
    icon: Rocket,
    title: "Pick your cert",
    desc: "Choose from AWS, Azure, GCP, Kubernetes and dozens more community-curated tracks.",
  },
  {
    step: "02",
    icon: Brain,
    title: "Train daily",
    desc: "Adaptive mock exams, flashcards, and weakness mode — 15 minutes a day is enough.",
  },
  {
    step: "03",
    icon: Trophy,
    title: "Pass with confidence",
    desc: "Real-time pass probability and domain mastery shows when you're truly exam-ready.",
  },
];

const benefits = [
  "Realistic exam timer & lab-style scenarios",
  "Spaced repetition that adapts to your weak spots",
  "Detailed explanations written by the community",
  "Pass-probability score updated after every session",
  "AI-generated questions to drill any sub-topic",
  "Free forever for core practice — no credit card",
];

const testimonials = [
  {
    quote:
      "Went from 58% to 84% on practice exams in three weeks. The weakness mode is unreal.",
    name: "Priya S.",
    role: "Passed AWS SAA-C03",
    accent: "primary",
  },
  {
    quote:
      "Finally a prep platform that feels like leveling up a character, not grinding flashcards.",
    name: "Marcus T.",
    role: "Passed AZ-104",
    accent: "accent",
  },
  {
    quote:
      "The community explanations are better than the paid courses I bought. Saved me $300.",
    name: "Linh N.",
    role: "Passed CKA",
    accent: "primary",
  },
];

const StatFallback = [
  { value: "—", label: "Questions" },
  { value: "—", label: "Certifications" },
  { value: "—", label: "Exams Taken" },
  { value: "—", label: "Pass Rate" },
];

const Index = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const {
    data: certifications,
    isLoading,
    error,
  } = useQuery({ queryKey: ["certifications"], queryFn: getCertifications });
  const { data: pointsData } = useQuery({
    queryKey: ["my-points"],
    queryFn: getMyPoints,
    enabled: isAuthenticated,
  });
  const { data: platformStats } = useQuery<PlatformStats>({
    queryKey: ["platform-stats"],
    queryFn: getPlatformStats,
  });

  const stats = platformStats
    ? [
        { value: formatStat(platformStats.totalQuestions), label: "Questions" },
        {
          value: formatStat(platformStats.totalCertifications),
          label: "Certifications",
        },
        {
          value: formatStat(platformStats.totalExamAttempts),
          label: "Exams Taken",
        },
        {
          value: `${platformStats.averagePassRate}%`,
          label: "Pass Rate",
        },
      ]
    : StatFallback;

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Radial depth */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,hsl(var(--primary)/0.12),transparent_70%)]" />
        {/* Cyber grid */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-primary/5 blur-[140px]" />

        <div className="container relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">
                The Brain Gym for Certifications
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold font-mono tracking-tight leading-[1.1] mb-8">
              <span className="block text-foreground">
                Master your certification
              </span>
              <span
                className="block text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary"
                style={{
                  filter: "drop-shadow(0 0 18px hsl(var(--primary) / 0.35))",
                }}
              >
                with the community
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto">
              Create, share, and practice mock exams for global certifications.{" "}
              <span className="text-foreground/90 font-medium italic">
                Pinpoint weak spots.
              </span>{" "}
              Improve every day.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="glow-cyan font-mono"
                onClick={() => {
                  document
                    .getElementById("certification-library")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Start Training Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="font-mono"
                onClick={() => navigate("/questions")}
              >
                Browse Questions
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground font-mono">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> Free forever
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> No credit card
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> 15 min / day
              </span>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 mt-20 max-w-3xl mx-auto pt-12 border-t border-border/50"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="text-center flex flex-col gap-1">
                <div className="text-3xl md:text-4xl font-bold font-mono text-gradient-cyan">
                  {stat.value}
                </div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </section>

      {/* Certifications */}
      <section
        id="certification-library"
        className="py-20 border-t border-border"
      >
        <div className="container">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold font-mono mb-3">
              Certification Library
            </h2>
            <p className="text-muted-foreground">
              Pick a certification and start practicing
            </p>
          </motion.div>
          <div className="max-w-5xl mx-auto">
            {isLoading ? (
              <CardSkeleton count={6} />
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(certifications && certifications.length > 0
                  ? certifications
                  : fallbackCertifications
                ).map((cert, i) => (
                  <motion.div
                    key={cert.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="h-full"
                  >
                    <CertificationCard
                      cert={cert}
                      onClick={() => navigate(`/exam/${cert.id}`)}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_50%,hsl(var(--accent)/0.07),transparent_60%)]" />
        <div className="container relative">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full border border-accent/30 bg-accent/10">
              <Sparkles className="h-3 w-3 text-accent" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-accent font-bold">
                How it works
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold font-mono mb-3">
              From zero to certified in{" "}
              <span className="text-gradient-cyan">three steps</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              A focused training loop that turns daily reps into a real exam pass.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto relative">
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            {howItWorks.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="relative glass-card p-6 text-center group hover:border-primary/40 transition-colors"
              >
                <div className="relative mx-auto mb-5 h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/30 flex items-center justify-center glow-cyan">
                  <s.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="font-mono text-[10px] tracking-widest text-primary mb-2">
                  STEP {s.step}
                </div>
                <h3 className="font-mono font-semibold text-lg mb-2">
                  {s.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {s.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t border-border">
        <div className="container">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold font-mono mb-3">
              More than just{" "}
              <span className="text-gradient-cyan">practice tests</span>
            </h2>
            <p className="text-muted-foreground">
              A complete certification training ecosystem
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card p-6 hover:border-primary/30 transition-colors group"
              >
                <f.icon className="h-8 w-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="font-mono font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits + Mock UI panel */}
      <section className="py-20 border-t border-border relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="container relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full border border-primary/30 bg-primary/10">
                <TrendingUp className="h-3 w-3 text-primary" />
                <span className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">
                  Built for learners
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold font-mono mb-4 leading-tight">
                Train smarter,{" "}
                <span className="text-gradient-cyan">not longer</span>
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Every session adapts to what you got wrong yesterday. No more
                grinding through 1,000 random questions hoping it sticks.
              </p>
              <ul className="space-y-3">
                {benefits.map((b, i) => (
                  <motion.li
                    key={b}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-start gap-3"
                  >
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 border border-accent/40">
                      <CheckCircle2 className="h-3 w-3 text-accent" />
                    </div>
                    <span className="text-sm text-foreground/90">{b}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              {/* Mock dashboard card */}
              <div className="glass-card p-6 glow-cyan relative">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      Readiness
                    </div>
                    <div className="text-3xl font-bold font-mono text-gradient-cyan">
                      87%
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent/15 border border-accent/30">
                    <TrendingUp className="h-3 w-3 text-accent" />
                    <span className="text-[11px] font-mono text-accent font-bold">
                      +12%
                    </span>
                  </div>
                </div>
                {/* Bars */}
                <div className="space-y-3 mb-5">
                  {[
                    { label: "Compute", val: 92 },
                    { label: "Networking", val: 78 },
                    { label: "Security", val: 65 },
                    { label: "Storage", val: 88 },
                  ].map((d, i) => (
                    <div key={d.label}>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span className="text-muted-foreground">{d.label}</span>
                        <span className="text-foreground">{d.val}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${d.val}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, delay: 0.2 + i * 0.1 }}
                          className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-warning" />
                    <span className="text-sm font-mono">12 day streak</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-mono text-muted-foreground">
                      14 min today
                    </span>
                  </div>
                </div>
              </div>
              {/* Floating badge */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
                className="absolute -bottom-5 -left-5 glass-card px-4 py-3 flex items-center gap-3 glow-green"
              >
                <div className="h-8 w-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center">
                  <Trophy className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <div className="text-xs font-mono text-accent">
                    Badge unlocked
                  </div>
                  <div className="text-sm font-mono font-semibold">
                    Perfect run
                  </div>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 }}
                className="absolute -top-5 -right-5 glass-card px-4 py-2"
              >
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Pass probability
                </div>
                <div className="text-lg font-bold font-mono text-gradient-cyan">
                  91%
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 border-t border-border">
        <div className="container">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold font-mono mb-3">
              Learners who <span className="text-gradient-cyan">passed</span>
            </h2>
            <p className="text-muted-foreground">
              Real stories from the CertGym community
            </p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-6 flex flex-col hover:border-primary/30 transition-colors"
              >
                <Quote className="h-6 w-6 text-primary/60 mb-3" />
                <p className="text-sm text-foreground/90 leading-relaxed mb-5 flex-1">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-border">
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center font-mono font-bold text-sm ${
                      t.accent === "primary"
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "bg-accent/15 text-accent border border-accent/30"
                    }`}
                  >
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold">
                      {t.name}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {t.role}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.15),transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="container relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center glass-card p-10 md:p-14 glow-cyan border-primary/30"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 border border-primary/40 mb-6">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-3xl md:text-5xl font-bold font-mono mb-4 leading-tight">
              Your certification is{" "}
              <span className="text-gradient-cyan">90 days away</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Join thousands of learners training daily. Free to start, no
              credit card, no fluff.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="glow-cyan font-mono"
                onClick={() =>
                  navigate(isAuthenticated ? "/dashboard" : "/auth")
                }
              >
                {isAuthenticated ? "Open Dashboard" : "Create Free Account"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="font-mono"
                onClick={() => {
                  document
                    .getElementById("certification-library")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Explore Certifications
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border pb-24 md:pb-8">
        <div className="container text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="font-mono font-semibold text-gradient-cyan">
              CertGym
            </span>
          </div>
          <p>Community-powered certification training platform</p>
        </div>
      </footer>
    </main>
  );
};

export default Index;
