import { Test, TestingModule } from '@nestjs/testing';
import { ChallansController } from './challans.controller';

describe('ChallansController', () => {
  let controller: ChallansController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChallansController],
    }).compile();

    controller = module.get<ChallansController>(ChallansController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
