import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { PrismaService } from './database/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  const prisma = {
    $queryRaw: jest.fn(),
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
    it('returns an ISO timestamp and ok status after checking the database', async () => {
      prisma.$queryRaw.mockResolvedValue([{ connected: 1 }]);
      const response = await appController.health();

      expect(response.status).toBe('ok');
      expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('does not report healthy when the database check fails', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('database unavailable'));

      await expect(appController.health()).rejects.toThrow(
        'database unavailable',
      );
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
