import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";

const rows: { label: string; free: boolean | string; account: boolean | string }[] = [
  { label: "Browse the community question bank", free: true, account: true },
  { label: "Study mode with instant feedback", free: true, account: true },
  { label: "Try sample quiz questions", free: true, account: true },
  { label: "Full explanations on every question", free: false, account: true },
  { label: "Timed mock exams", free: false, account: true },
  { label: "Weakness targeting & readiness score", free: false, account: true },
  { label: "Spaced-repetition flashcards", free: false, account: true },
  { label: "Save progress across devices", free: false, account: true },
  { label: "Leaderboard & badges", free: false, account: true },
  { label: "Create & share your own exams", free: false, account: true },
];

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return <span className="text-sm text-foreground/90">{value}</span>;
  }
  return value ? (
    <Check className="h-4 w-4 text-accent mx-auto" />
  ) : (
    <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" />
  );
}

export function ComparisonSection() {
  return (
    <section className="py-20 border-t border-border">
      <div className="container">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold font-mono mb-3">
            What you get, <span className="text-gradient-cyan">without and with</span> an account
          </h2>
          <p className="text-muted-foreground">
            Browse and study freely. Sign up when you want the full training loop.
          </p>
        </motion.div>
        <div className="max-w-2xl mx-auto glass-card overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-3 border-b border-border text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            <span>Feature</span>
            <span className="text-center w-16">No account</span>
            <span className="text-center w-16 text-primary">Free account</span>
          </div>
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-3 border-b border-border/60 last:border-0 items-center"
            >
              <span className="text-sm">{row.label}</span>
              <span className="w-16 text-center">
                <Cell value={row.free} />
              </span>
              <span className="w-16 text-center">
                <Cell value={row.account} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
