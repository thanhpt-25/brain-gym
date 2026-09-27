import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Target,
  BarChart3,
  Users,
  Zap,
  BookOpen,
  Flame,
  Clock,
  TrendingUp,
  Trophy,
} from "lucide-react";

const features = [
  {
    icon: Target,
    title: "Exam Simulation",
    desc: "Timer, navigation, mark for review — like real exams.",
    href: "/exams",
  },
  {
    icon: BarChart3,
    title: "Weakness Targeting",
    desc: "Auto-built drills from the domains you miss most, with a readiness score that updates every session.",
    href: "/training",
  },
  {
    icon: Users,
    title: "Community Driven",
    desc: "Create and share exams. Voting, reviews, verification.",
    href: "/exams",
  },
  {
    icon: Zap,
    title: "AI Assist",
    desc: "Generate questions, improve explanations, detect duplicates.",
    href: "/ai-generate",
  },
  {
    icon: BookOpen,
    title: "Study Mode",
    desc: "Instant feedback while you browse questions, no timer pressure.",
    href: "/questions",
  },
  {
    icon: Trophy,
    title: "Spaced-Repetition Flashcards",
    desc: "SM-2 scheduling moves cards from new to mastered as you review.",
    href: "/decks",
  },
];

export function WhatYouGetSection() {
  return (
    <section className="py-20 border-t border-border relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="container relative">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold font-mono mb-3">
            More than just <span className="text-gradient-cyan">practice tests</span>
          </h2>
          <p className="text-muted-foreground">
            A complete certification training ecosystem
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 items-start max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
              >
                <Link
                  to={f.href}
                  className="block glass-card p-6 hover:border-primary/30 transition-colors group h-full"
                >
                  <f.icon className="h-8 w-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="font-mono font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </Link>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
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
            <div className="mt-3 text-center text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
              Sample dashboard — yours starts at 0%
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
