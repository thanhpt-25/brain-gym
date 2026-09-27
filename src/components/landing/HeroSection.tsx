import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Certification } from "@/types/exam";

interface HeroSectionProps {
  certifications: Certification[];
}

function providerName(cert: Certification): string | undefined {
  return typeof cert.provider === "object" ? cert.provider?.name : cert.provider;
}

export function HeroSection({ certifications }: HeroSectionProps) {
  const navigate = useNavigate();
  const providers = Array.from(
    new Set(certifications.map(providerName).filter(Boolean)),
  ).slice(0, 6) as string[];

  return (
    <section className="relative pt-32 pb-24 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,hsl(var(--primary)/0.12),transparent_70%)]" />
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
            <span className="block text-foreground">Pass your certification</span>
            <span
              className="block text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary"
              style={{ filter: "drop-shadow(0 0 18px hsl(var(--primary) / 0.35))" }}
            >
              practice free, no card needed
            </span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto">
            Try real practice questions right now.{" "}
            <span className="text-foreground/90 font-medium italic">
              Pinpoint weak spots.
            </span>{" "}
            Create a free account when you're ready for timed exams and full
            explanations.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="glow-cyan font-mono"
              onClick={() =>
                document
                  .getElementById("try-it-quiz")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Try 5 free questions
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="font-mono"
              onClick={() => navigate("/auth")}
            >
              Create free account
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground font-mono">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> Free forever
              for core practice
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> No credit
              card
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> No sign-up
              to try it
            </span>
          </div>

          {providers.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-14 pt-8 border-t border-border/50"
            >
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-3">
                Certification tracks in the library
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-mono text-foreground/70">
                {providers.map((p) => (
                  <span key={p}>{p}</span>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground max-w-2xl mx-auto">
                Practice exams for AWS Solutions Architect (SAA-C03), Azure
                Fundamentals (AZ-900), Google Cloud Associate Cloud Engineer,
                Kubernetes CKA/CKAD, CompTIA Security+/Network+, PMP, CISSP,
                and Cisco CCNA.
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </section>
  );
}
