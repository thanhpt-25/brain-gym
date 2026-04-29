import { PrismaService } from '../../src/prisma/prisma.service';

export interface ProviderResult {
  id: string;
  name: string;
  slug: string;
}

/**
 * Idempotent upsert of a test provider.
 *
 * Because cleanDb() truncates between tests this will almost always create a
 * new row, but the upsert keeps things safe when providers are seeded in
 * globalSetup or not cleaned between suites.
 */
export async function getOrCreateProvider(
  prisma: PrismaService,
  slug: string,
  name?: string,
): Promise<ProviderResult> {
  const providerName = name ?? `Test Provider ${slug}`;

  const existing = await prisma.provider.findUnique({ where: { slug } });
  if (existing) {
    return { id: existing.id, name: existing.name, slug: existing.slug };
  }

  const created = await prisma.provider.create({
    data: { name: providerName, slug },
  });
  return { id: created.id, name: created.name, slug: created.slug };
}

/**
 * Creates a certification under a provider, upserting the provider first.
 */
export async function getOrCreateCertification(
  prisma: PrismaService,
  opts: {
    providerSlug?: string;
    certCode: string;
    certName?: string;
  },
): Promise<{ certId: string; providerId: string }> {
  const provider = await getOrCreateProvider(
    prisma,
    opts.providerSlug ?? 'e2e-provider',
  );

  const cert = await prisma.certification.upsert({
    where: { code: opts.certCode },
    update: { name: opts.certName ?? opts.certCode, providerId: provider.id },
    create: {
      name: opts.certName ?? opts.certCode,
      code: opts.certCode,
      providerId: provider.id,
    },
  });

  return { certId: cert.id, providerId: provider.id };
}
