import { Test, TestingModule } from '@nestjs/testing';
import { CertificationsService } from './certifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

const mockCertification = {
  id: 'uuid-1',
  name: 'Test Cert',
  provider: 'AWS',
  code: 'T-01',
  description: 'Desc',
  isActive: true,
  createdAt: new Date(),
  domains: [],
  questionCount: 0,
};

const mockPrismaService = {
  certification: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  domain: {
    deleteMany: jest.fn(),
  },
};

describe('CertificationsService', () => {
  let service: CertificationsService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CertificationsService>(CertificationsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all active certifications by default', async () => {
      prisma.certification.findMany.mockResolvedValue([mockCertification]);
      const result = await service.findAll();
      expect(prisma.certification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
      expect(result).toEqual([mockCertification]);
    });

    it('should include inactive ones if requested', async () => {
      prisma.certification.findMany.mockResolvedValue([mockCertification]);
      await service.findAll(true);
      expect(prisma.certification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });
  });

  describe('create', () => {
    it('should throw ConflictException if code already exists', async () => {
      prisma.certification.findUnique.mockResolvedValue(mockCertification);
      await expect(
        service.create({
          name: 'New',
          providerId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          code: 'T-01',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create certification if code is unique', async () => {
      prisma.certification.findUnique.mockResolvedValue(null);
      prisma.certification.create.mockResolvedValue(mockCertification);
      const result = await service.create({
        name: 'New',
        providerId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        code: 'T-NEW',
      });
      expect(result).toEqual(mockCertification);
    });
  });

  describe('update', () => {
    it('should throw ConflictException if new code is already used by another cert', async () => {
      prisma.certification.findUnique
        .mockResolvedValueOnce(mockCertification) // lookup original
        .mockResolvedValueOnce({ id: 'uuid-2', code: 'T-USED' }); // lookup new code conflict

      await expect(
        service.update('uuid-1', { code: 'T-USED' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should delete existing domains if domains list is provided', async () => {
      prisma.certification.findUnique.mockResolvedValue(mockCertification);
      prisma.certification.update.mockResolvedValue(mockCertification);

      await service.update('uuid-1', { domains: ['New Domain'] });
      expect(prisma.domain.deleteMany).toHaveBeenCalled();
      expect(prisma.certification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            domains: { create: [{ name: 'New Domain' }] },
          }),
        }),
      );
    });
  });

  describe('softDelete', () => {
    it('should set isActive to false', async () => {
      prisma.certification.findUnique.mockResolvedValue(mockCertification);
      prisma.certification.update.mockResolvedValue({
        ...mockCertification,
        isActive: false,
      });

      const result = await service.softDelete('uuid-1');
      expect(prisma.certification.update).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });
  });
});
