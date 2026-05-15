import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrgKind, OrgRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SQUAD_INVITE_DAILY_LIMIT } from './squads.constants';
import { SquadsService } from './squads.service';

const SQUAD_ID = 'squad-uuid-1';
const USER_ID = 'user-uuid-1';
const CERT_ID = 'cert-uuid-1';
const INVITE_CODE = 'abcdef12';

describe('SquadsService', () => {
  let service: SquadsService;

  const mockPrisma = {
    organization: { create: jest.fn() },
    orgMember: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    orgJoinLink: {
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    delete process.env.FF_SQUADS_BETA;
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SquadsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SquadsService>(SquadsService);
  });

  // ─── assertFlagEnabled ────────────────────────────────────────────────────────

  describe('assertFlagEnabled', () => {
    it('throws NotFoundException when FF_SQUADS_BETA is not set', () => {
      expect(() => service.assertFlagEnabled()).toThrow(NotFoundException);
    });

    it('throws when FF_SQUADS_BETA is a non-true value', () => {
      process.env.FF_SQUADS_BETA = 'false';
      expect(() => service.assertFlagEnabled()).toThrow(NotFoundException);
    });

    it('does not throw when FF_SQUADS_BETA is "true"', () => {
      process.env.FF_SQUADS_BETA = 'true';
      expect(() => service.assertFlagEnabled()).not.toThrow();
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    const mockOrg = {
      id: SQUAD_ID,
      kind: OrgKind.SQUAD,
      name: 'AWS Study Crew',
      slug: 'aws-study-crew-x1y2',
      certificationId: CERT_ID,
    };
    const mockMember = {
      id: 'member-1',
      orgId: SQUAD_ID,
      userId: USER_ID,
      role: OrgRole.OWNER,
    };

    beforeEach(() => {
      mockPrisma.organization.create.mockResolvedValue(mockOrg);
      mockPrisma.orgMember.create.mockResolvedValue(mockMember);
    });

    it('creates Organization with kind=SQUAD', async () => {
      await service.create(USER_ID, {
        name: 'AWS Study Crew',
        certificationId: CERT_ID,
      });

      expect(mockPrisma.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kind: OrgKind.SQUAD,
            certificationId: CERT_ID,
          }),
        }),
      );
    });

    it('creates OWNER OrgMember for the creator', async () => {
      await service.create(USER_ID, {
        name: 'AWS Study Crew',
        certificationId: CERT_ID,
      });

      expect(mockPrisma.orgMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            orgId: mockOrg.id,
            role: OrgRole.OWNER,
            isActive: true,
          }),
        }),
      );
    });

    it('returns org and member', async () => {
      const result = await service.create(USER_ID, {
        name: 'AWS Study Crew',
        certificationId: CERT_ID,
      });

      expect(result.org).toEqual(mockOrg);
      expect(result.member).toEqual(mockMember);
    });

    it('passes targetExamDate when provided', async () => {
      await service.create(USER_ID, {
        name: 'My Squad',
        certificationId: CERT_ID,
        targetExamDate: '2026-09-01',
      });

      expect(mockPrisma.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            targetExamDate: new Date('2026-09-01'),
          }),
        }),
      );
    });

    it('generates a slugified name with 4-char random suffix', async () => {
      await service.create(USER_ID, {
        name: 'AWS Study Crew',
        certificationId: CERT_ID,
      });

      const { slug } = mockPrisma.organization.create.mock.calls[0][0].data;
      expect(slug).toMatch(/^aws-study-crew-[a-z0-9]{4}$/);
    });
  });

  // ─── createInvite ─────────────────────────────────────────────────────────────

  describe('createInvite', () => {
    const ownerMembership = {
      id: 'member-1',
      userId: USER_ID,
      orgId: SQUAD_ID,
      role: OrgRole.OWNER,
      isActive: true,
    };

    const mockLink = {
      id: 'link-1',
      code: INVITE_CODE,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
      orgId: SQUAD_ID,
    };

    it('throws ForbiddenException if caller has MEMBER role, not OWNER', async () => {
      mockPrisma.orgMember.findFirst.mockResolvedValueOnce({
        ...ownerMembership,
        role: OrgRole.MEMBER,
      });

      await expect(service.createInvite(USER_ID, SQUAD_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException if caller has no membership', async () => {
      mockPrisma.orgMember.findFirst.mockResolvedValueOnce(null);

      await expect(service.createInvite(USER_ID, SQUAD_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when daily invite limit reached', async () => {
      mockPrisma.orgMember.findFirst.mockResolvedValueOnce(ownerMembership);
      mockPrisma.orgJoinLink.count.mockResolvedValueOnce(
        SQUAD_INVITE_DAILY_LIMIT,
      );

      await expect(service.createInvite(USER_ID, SQUAD_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates single-use join link with 7-day TTL', async () => {
      mockPrisma.orgMember.findFirst.mockResolvedValueOnce(ownerMembership);
      mockPrisma.orgJoinLink.count.mockResolvedValueOnce(0);
      mockPrisma.orgJoinLink.create.mockResolvedValueOnce(mockLink);

      await service.createInvite(USER_ID, SQUAD_ID);

      const createCall = mockPrisma.orgJoinLink.create.mock.calls[0][0];
      expect(createCall.data).toMatchObject({
        orgId: SQUAD_ID,
        maxUses: 1,
        isActive: true,
      });

      const diffMs = createCall.data.expiresAt.getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(6 * 24 * 60 * 60 * 1000); // > 6 days
      expect(diffMs).toBeLessThan(8 * 24 * 60 * 60 * 1000); // < 8 days
    });

    it('returns inviteUrl, code, and expiresAt', async () => {
      mockPrisma.orgMember.findFirst.mockResolvedValueOnce(ownerMembership);
      mockPrisma.orgJoinLink.count.mockResolvedValueOnce(0);
      mockPrisma.orgJoinLink.create.mockResolvedValueOnce(mockLink);

      const result = await service.createInvite(USER_ID, SQUAD_ID);

      expect(result.inviteUrl).toBe(`/squads/join/${INVITE_CODE}`);
      expect(result.code).toBe(INVITE_CODE);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });

  // ─── join ─────────────────────────────────────────────────────────────────────

  describe('join', () => {
    const validLink = {
      id: 'link-1',
      code: INVITE_CODE,
      orgId: SQUAD_ID,
      isActive: true,
      maxUses: 1,
      currentUses: 0,
      expiresAt: new Date(Date.now() + 86_400_000),
    };

    const createdMember = {
      id: 'member-new',
      userId: USER_ID,
      orgId: SQUAD_ID,
      role: OrgRole.MEMBER,
    };

    beforeEach(() => {
      mockPrisma.$transaction.mockImplementation(
        (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
      );
    });

    it('throws NotFoundException for unknown code', async () => {
      mockPrisma.orgJoinLink.findUnique.mockResolvedValueOnce(null);

      await expect(service.join(USER_ID, 'bad-code')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for inactive link', async () => {
      mockPrisma.orgJoinLink.findUnique.mockResolvedValueOnce({
        ...validLink,
        isActive: false,
      });

      await expect(service.join(USER_ID, INVITE_CODE)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws GoneException for expired link', async () => {
      mockPrisma.orgJoinLink.findUnique.mockResolvedValueOnce({
        ...validLink,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.join(USER_ID, INVITE_CODE)).rejects.toThrow(
        GoneException,
      );
    });

    it('throws BadRequestException when maxUses exhausted', async () => {
      mockPrisma.orgJoinLink.findUnique.mockResolvedValueOnce({
        ...validLink,
        currentUses: 1,
      });

      await expect(service.join(USER_ID, INVITE_CODE)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException if user is already an active member', async () => {
      mockPrisma.orgJoinLink.findUnique.mockResolvedValueOnce(validLink);
      mockPrisma.orgMember.findFirst.mockResolvedValueOnce({ id: 'existing' });

      await expect(service.join(USER_ID, INVITE_CODE)).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates MEMBER and increments currentUses atomically', async () => {
      mockPrisma.orgJoinLink.findUnique.mockResolvedValueOnce(validLink);
      mockPrisma.orgMember.findFirst.mockResolvedValueOnce(null);
      mockPrisma.orgMember.create.mockResolvedValueOnce(createdMember);
      mockPrisma.orgJoinLink.update.mockResolvedValueOnce({
        ...validLink,
        currentUses: 1,
      });

      const result = await service.join(USER_ID, INVITE_CODE);

      expect(mockPrisma.orgMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            orgId: SQUAD_ID,
            role: OrgRole.MEMBER,
            isActive: true,
          }),
        }),
      );
      expect(mockPrisma.orgJoinLink.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentUses: { increment: 1 } } }),
      );
      expect(result).toEqual(createdMember);
    });
  });
});
