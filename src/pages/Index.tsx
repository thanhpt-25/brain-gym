import { useQuery } from "@tanstack/react-query";
import { getCertifications } from "@/services/certifications";
import SEO from "@/components/SEO";
import { SITE_URL } from "@/lib/constants";
import Navbar from "@/components/Navbar";
import { fallbackCertifications } from "@/data/fallbackCertifications";
import { useAuthStore } from "@/stores/auth.store";
import { HeroSection } from "@/components/landing/HeroSection";
import { LoggedInBanner } from "@/components/landing/LoggedInBanner";
import { CertLibrarySection } from "@/components/landing/CertLibrarySection";
import { TryItQuiz } from "@/components/landing/TryItQuiz";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { WhatYouGetSection } from "@/components/landing/WhatYouGetSection";
import { ProofSection } from "@/components/landing/ProofSection";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { FinalCTASection } from "@/components/landing/FinalCTASection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { landingFAQs } from "@/data/landingFAQs";

const Index = () => {
  const { isAuthenticated } = useAuthStore();
  const {
    data: certifications,
    isLoading,
  } = useQuery({ queryKey: ["certifications"], queryFn: getCertifications });

  const hasLiveCertifications = !!certifications && certifications.length > 0;
  const displayedCertifications = hasLiveCertifications
    ? certifications
    : fallbackCertifications;
  // The try-it quiz needs real question data behind a cert, so it only makes
  // sense to offer once the live certification list has loaded.
  const quizCertifications = hasLiveCertifications ? certifications : [];

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <SEO
        title="Certification Exam Prep — Practice Tests & Flashcards"
        description="Community-driven platform for AWS, Azure, GCP, Kubernetes, CompTIA, PMP, and CISSP certification prep. Free practice exams, mock tests, AI-powered flashcards, adaptive learning, and detailed analytics."
        keywords={[
          "certification exam prep",
          "practice exam",
          "mock exam",
          "free practice test",
          "AWS certification exam prep",
          "AWS Solutions Architect Associate practice exam",
          "Azure certification exam prep",
          "AZ-900 practice test",
          "Google Cloud certification exam prep",
          "GCP Associate Cloud Engineer practice exam",
          "Kubernetes certification exam prep",
          "CKA practice exam",
          "CKAD practice exam",
          "CompTIA Security+ practice test",
          "CompTIA Network+ practice test",
          "PMP exam prep",
          "CISSP practice questions",
          "Cisco CCNA practice exam",
          "IT certification flashcards",
          "spaced repetition flashcards",
          "adaptive learning exam prep",
        ]}
        canonical="/"
        jsonLd={[
          {
            "@type": "WebSite",
            name: "CertGym",
            url: SITE_URL,
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: `${SITE_URL}/questions?search={search_term_string}`,
              },
              "query-input": "required name=search_term_string",
            },
          },
          {
            "@type": "EducationalOrganization",
            name: "CertGym",
            url: SITE_URL,
            description:
              "Community-driven certification exam preparation platform with practice exams, flashcards, and AI-powered learning for cloud and IT certifications.",
            sameAs: [`${SITE_URL}`],
          },
          {
            "@type": "FAQPage",
            mainEntity: landingFAQs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
              },
            })),
          },
        ]}
      />
      <Navbar />
      {isAuthenticated && <LoggedInBanner />}

      <HeroSection certifications={displayedCertifications} />

      <CertLibrarySection
        certifications={displayedCertifications}
        isLoading={isLoading}
        isFallback={!hasLiveCertifications}
      />

      <section id="try-it-quiz" className="py-20 border-t border-border">
        <div className="container">
          <TryItQuiz certifications={quizCertifications} />
        </div>
      </section>

      <HowItWorksSection />
      <WhatYouGetSection />
      <ProofSection />
      <ComparisonSection />
      <FAQSection />
      <FinalCTASection />
      <LandingFooter />
    </main>
  );
};

export default Index;
