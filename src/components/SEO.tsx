import { Helmet } from "react-helmet-async";
import { SITE_URL, SITE_NAME } from "@/lib/constants";

export interface JsonLdSchema {
  "@type": string;
  [key: string]: unknown;
}

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  locale?: string;
  noIndex?: boolean;
  jsonLd?: JsonLdSchema | JsonLdSchema[];
}

const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;
const DEFAULT_DESCRIPTION =
  "Community-driven certification exam preparation. Free practice exams, mock tests, flashcards, and AI-powered learning for AWS, Azure, GCP, Kubernetes, CompTIA, PMP, CISSP, Cisco, and more IT certifications.";

// Broad, high-intent keyword set reused as the default so every page ships
// with baseline coverage even if it doesn't pass its own `keywords`.
const DEFAULT_KEYWORDS = [
  "certification exam prep",
  "practice exam",
  "mock exam",
  "exam simulator",
  "flashcards",
  "AWS certification",
  "AWS Solutions Architect practice exam",
  "Azure certification",
  "AZ-900 practice test",
  "Google Cloud certification",
  "GCP Associate Cloud Engineer",
  "Kubernetes certification",
  "CKA practice exam",
  "CKAD practice exam",
  "CompTIA Security+",
  "CompTIA Network+",
  "CompTIA A+",
  "PMP exam prep",
  "CISSP practice questions",
  "Cisco CCNA practice exam",
  "IT certification practice questions",
  "spaced repetition flashcards",
  "adaptive learning exam prep",
];

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords,
  canonical,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = "website",
  locale = "vi_VN",
  noIndex = false,
  jsonLd,
}: SEOProps) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
  const canonicalUrl = canonical ? `${SITE_URL}${canonical}` : undefined;
  const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={(keywords ?? DEFAULT_KEYWORDS).join(", ")} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      {noIndex && <meta name="robots" content="noindex,nofollow" />}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content={locale} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify({ "@context": "https://schema.org", ...schema })}
        </script>
      ))}
    </Helmet>
  );
}
