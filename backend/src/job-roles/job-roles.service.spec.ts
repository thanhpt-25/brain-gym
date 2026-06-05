// Mock OrganizationsService before any imports to prevent its transitive
// dependency on uuid (ESM-only) from breaking Jest's CJS transform.
jest.mock('../organizations/organizations.service');

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { JobRolesService } from './job-roles.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';

const mockPrisma = {
  jobRole: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockOrgsService = {
  resolveOrgId: jest.fn().mockResolvedValue('org-1'),
};

describe('JobRolesService', () => {
  let service: JobRolesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobRolesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OrganizationsService, useValue: mockOrgsService },
      ],
    }).compile();
    service = module.get<JobRolesService>(JobRolesService);
  });

  describe('list', () => {
    it('returns job roles for the org', async () => {
      const roles = [{ id: 'r1', title: 'Engineer', isActive: true }];
      mockPrisma.jobRole.findMany.mockResolvedValue(roles);
      const result = await service.list('my-org');
      expect(result).toEqual(roles);
      expect(mockPrisma.jobRole.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: 'org-1' } }),
      );
    });
  });

  describe('create', () => {
    it('creates a job role with required fields', async () => {
      const created = { id: 'r1', title: 'Designer', department: null, isActive: true };
      mockPrisma.jobRole.create.mockResolvedValue(created);
      const result = await service.create('my-org', { title: 'Designer' });
      expect(result).toEqual(created);
      expect(mockPrisma.jobRole.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ orgId: 'org-1', title: 'Designer' }),
        }),
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundException when role not found', async () => {
      mockPrisma.jobRole.findFirst.mockResolvedValue(null);
      await expect(service.update('my-org', 'bad-id', { title: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates job role when found', async () => {
      mockPrisma.jobRole.findFirst.mockResolvedValue({ id: 'r1' });
      mockPrisma.jobRole.update.mockResolvedValue({ id: 'r1', title: 'Updated' });
      const result = await service.update('my-org', 'r1', { title: 'Updated' });
      expect(result).toEqual({ id: 'r1', title: 'Updated' });
    });

    it('can toggle isActive', async () => {
      mockPrisma.jobRole.findFirst.mockResolvedValue({ id: 'r1' });
      mockPrisma.jobRole.update.mockResolvedValue({ id: 'r1', isActive: false });
      const result = await service.update('my-org', 'r1', { isActive: false });
      expect(mockPrisma.jobRole.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when role not found', async () => {
      mockPrisma.jobRole.findFirst.mockResolvedValue(null);
      await expect(service.remove('my-org', 'bad-id')).rejects.toThrow(NotFoundException);
    });

    it('deletes the role when found', async () => {
      mockPrisma.jobRole.findFirst.mockResolvedValue({ id: 'r1' });
      mockPrisma.jobRole.delete.mockResolvedValue({ id: 'r1' });
      await service.remove('my-org', 'r1');
      expect(mockPrisma.jobRole.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
    });
  });
});
