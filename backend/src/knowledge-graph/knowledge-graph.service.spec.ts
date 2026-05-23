import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { PrismaService } from '../prisma/prisma.service';

describe('KnowledgeGraphService', () => {
  let service: KnowledgeGraphService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeGraphService,
        {
          provide: PrismaService,
          useValue: {
            certification: {
              findUnique: jest.fn(),
            },
            domain: {
              findMany: jest.fn(),
            },
            domainRelation: {
              findMany: jest.fn(),
            },
            knowledgeGraphMeta: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<KnowledgeGraphService>(KnowledgeGraphService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getKnowledgeGraph', () => {
    it('should return graph nodes and edges for certification', async () => {
      const certId = 'cert-1';

      jest.spyOn(prisma.certification, 'findUnique').mockResolvedValue({
        id: certId,
        name: 'AWS Solutions Architect',
      } as any);

      jest.spyOn(prisma.domain, 'findMany').mockResolvedValue([
        {
          id: 'dom-1',
          name: 'EC2',
          certificationId: certId,
        },
        {
          id: 'dom-2',
          name: 'S3',
          certificationId: certId,
        },
      ] as any);

      jest.spyOn(prisma.domainRelation, 'findMany').mockResolvedValue([
        {
          id: 'rel-1',
          fromDomainId: 'dom-1',
          toDomainId: 'dom-2',
          overlapPercentage: 45,
        },
      ] as any);

      const result = await service.getKnowledgeGraph(certId);

      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('edges');
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
    });
  });

  describe('getDrillDown', () => {
    it('should return skip and must-learn topics for domain', async () => {
      const certId = 'cert-1';
      const domainId = 'dom-1';

      const result = await service.getDrillDown(certId, domainId);

      expect(result).toHaveProperty('skipTopics');
      expect(result).toHaveProperty('mustLearnTopics');
    });
  });

  describe('getStudyPlan', () => {
    it('should return effort percentage and study plan columns', async () => {
      const certId = 'cert-1';

      const result = await service.getStudyPlan(certId);

      expect(result).toHaveProperty('effortPercentage');
      expect(result).toHaveProperty('skipColumn');
      expect(result).toHaveProperty('mustLearnColumn');
    });
  });

  describe('triggerOverlapCompute', () => {
    it('should trigger async overlap computation', async () => {
      const certId = 'cert-1';

      jest.spyOn(prisma.knowledgeGraphMeta, 'upsert').mockResolvedValue({
        certificationId: certId,
        computedAt: new Date(),
      } as any);

      const result = await service.triggerOverlapCompute(certId);

      expect(result).toHaveProperty('computedAt');
    });
  });
});
