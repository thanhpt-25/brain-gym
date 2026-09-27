import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CardSkeleton } from "@/components/PageSkeleton";
import CertificationCard from "@/components/CertificationCard";
import { Certification } from "@/types/exam";

interface CertLibrarySectionProps {
  certifications: Certification[] | undefined;
  isLoading: boolean;
  isFallback: boolean;
}

export function CertLibrarySection({
  certifications,
  isLoading,
  isFallback,
}: CertLibrarySectionProps) {
  const navigate = useNavigate();

  return (
    <section id="certification-library" className="py-20 border-t border-border">
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
              {(certifications ?? []).map((cert, i) => (
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
                    isFallback={isFallback}
                    onClick={() => navigate(`/exam/${cert.id}`)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
