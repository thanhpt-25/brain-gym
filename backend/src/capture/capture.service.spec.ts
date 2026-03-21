import { Test, TestingModule } from '@nestjs/testing';
import { CaptureService } from './capture.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('CaptureService', () => {
  let service: CaptureService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaptureService,
        {
          provide: PrismaService,
          useValue: {
            capture: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CaptureService>(CaptureService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
