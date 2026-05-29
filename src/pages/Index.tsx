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
                Start Training
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
