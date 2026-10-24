import { motion } from "framer-motion";
import { Rocket, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";

export function FinalCTASection() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  return (
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
            {isAuthenticated ? (
              <>Ready to pick up where you left off?</>
            ) : (
              <>
                Study at your own pace,{" "}
                <span className="text-gradient-cyan">for free</span>
              </>
            )}
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            {isAuthenticated
              ? "Jump back into your dashboard to continue training."
              : "Create a free account for timed exams, full explanations, and progress tracking. No credit card, no fluff."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="glow-cyan font-mono"
              onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
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
  );
}
