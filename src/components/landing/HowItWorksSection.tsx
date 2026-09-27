import { motion } from "framer-motion";
import { Rocket, Brain, Trophy, Sparkles } from "lucide-react";

const steps = [
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
    desc: "Timed mock exams, flashcards, and weakness-targeted drills — a little every day goes a long way.",
  },
  {
    step: "03",
    icon: Trophy,
    title: "Track your readiness",
    desc: "Domain-level accuracy and a readiness score show when you're truly exam-ready.",
  },
];

export function HowItWorksSection() {
  return (
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
            A focused training loop that turns daily reps into a real exam
            pass.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto relative">
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          {steps.map((s, i) => (
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
              <h3 className="font-mono font-semibold text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {s.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
