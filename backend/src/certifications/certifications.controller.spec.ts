import { Test, TestingModule } from '@nestjs/testing';
import { CertificationsController } from './certifications.controller';
import { CertificationsService } from './certifications.service';
import { CreateCertificationDto } from './dto/create-certification.dto';
import { UpdateCertificationDto } from './dto/update-certification.dto';

describe('CertificationsController', () => {
  let controller: CertificationsController;
  let service: CertificationsService;

  const mockService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CertificationsController],
      providers: [
        { provide: CertificationsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<CertificationsController>(CertificationsController);
    service = module.get<CertificationsService>(CertificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call service.findAll with false by default', async () => {
      await controller.findAll();
      expect(service.findAll).toHaveBeenCalledWith(false);
    });

    it('should call service.findAll with true if query param is set', async () => {
      await controller.findAll('true');
      expect(service.findAll).toHaveBeenCalledWith(true);
    });
  });

  describe('create', () => {
    it('should call service.create', async () => {
      const dto: CreateCertificationDto = { name: 'Test', providerId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', code: 'T1' };
      await controller.create(dto);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should call service.update', async () => {
      const dto: UpdateCertificationDto = { name: 'Updated' };
      await controller.update('id1', dto);
      expect(service.update).toHaveBeenCalledWith('id1', dto);
    });
  });

  describe('remove', () => {
    it('should call service.softDelete', async () => {
      await controller.remove('id1');
      expect(service.softDelete).toHaveBeenCalledWith('id1');
    });
  });
});
