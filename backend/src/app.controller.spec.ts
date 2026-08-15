import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { PrismaService } from './database/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  const prisma = {
    siteSetting: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('returns an ISO timestamp and ok status', () => {
      const response = appController.health();

      expect(response.status).toBe('ok');
      expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);
    });
  });

  describe('root', () => {
    it('uses the configured frontend redirect URL', async () => {
      prisma.siteSetting.findUnique.mockResolvedValue({
        value: 'https://frontend.example.org',
      });

      await expect(appController.root()).resolves.toEqual({
        url: 'https://frontend.example.org',
      });
    });
  });
});
