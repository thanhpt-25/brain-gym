import { Link } from "react-router-dom";
import { Brain } from "lucide-react";

const columns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Practice",
    links: [
      { label: "Questions", href: "/questions" },
      { label: "Community Exams", href: "/exams" },
      { label: "Trap Questions", href: "/trap-questions" },
      { label: "Training Hub", href: "/training" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Leaderboard", href: "/leaderboard" },
      { label: "Create Free Account", href: "/auth" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="py-12 border-t border-border pb-24 md:pb-12">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-5 w-5 text-primary" />
              <span className="font-mono font-semibold text-gradient-cyan">
                CertGym
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              Community-powered certification training platform for AWS,
              Azure, GCP, and Kubernetes.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
                {col.title}
              </h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-sm text-foreground/80 hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-6 border-t border-border text-center text-sm text-muted-foreground">
          Community-powered certification training platform
        </div>
      </div>
    </footer>
  );
}
