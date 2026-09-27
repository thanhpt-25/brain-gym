export interface FAQItem {
  question: string;
  answer: string;
}

export const landingFAQs: FAQItem[] = [
  {
    question: "Is CertGym really free?",
    answer:
      "Yes. Browsing questions, study mode, and the try-it quiz need no account at all. A free account adds timed mock exams, full explanations, flashcards, and progress tracking — no credit card required.",
  },
  {
    question: "Which certifications are covered?",
    answer:
      "The community-curated library spans AWS, Azure, GCP, and Kubernetes tracks today, with more added as contributors submit and review questions.",
  },
  {
    question: "Are the questions real exam dumps?",
    answer:
      "No. Questions are written and reviewed by the community to test the same concepts as the real exam, not copies of proprietary exam content.",
  },
  {
    question: "How is my readiness score calculated?",
    answer:
      "Readiness combines your recent mock-exam scores, per-domain accuracy, and how consistently you're practicing — it updates after every session.",
  },
  {
    question: "Can my team or organization use CertGym?",
    answer:
      "Yes. Organizations get a private question bank, learning tracks, and progress dashboards for members — set one up from the org section after signing up.",
  },
];
