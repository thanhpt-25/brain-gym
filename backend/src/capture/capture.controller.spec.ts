import { Test, TestingModule } from '@nestjs/testing';
import { CaptureController } from './capture.controller';
import { CaptureService } from './capture.service';

describe('CaptureController', () => {
  let controller: CaptureController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaptureController],
      providers: [
        {
          provide: CaptureService,
          useValue: {
            capture: jest.fn(),
            getPending: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CaptureController>(CaptureController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
