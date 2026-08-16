import { PrismaService } from '../database/prisma.service';
import { resolveService } from '../../test/resolve-service';
import { SiteContentService } from './site-content.service';
import {
  DEFAULT_ABOUT_CONTENT,
  DEFAULT_HOME_CONTENT,
} from './site-content.defaults';

describe('SiteContentService', () => {
  const siteSetting = {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  };
  const auditRecord = { create: jest.fn() };
  const prisma = {
    siteSetting,
    $transaction: jest.fn((callback: (client: unknown) => unknown) =>
      Promise.resolve(callback({ auditRecord, siteSetting })),
    ),
  };
  let service: SiteContentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await resolveService(SiteContentService, [
      { provide: PrismaService, useValue: prisma },
    ]);
  });

  it('returns the designed defaults before an administrator customizes a page', async () => {
    siteSetting.findUnique.mockResolvedValue(null);

    await expect(service.home()).resolves.toEqual({
      content: DEFAULT_HOME_CONTENT,
      updatedAt: null,
    });
    await expect(service.about()).resolves.toEqual({
      content: DEFAULT_ABOUT_CONTENT,
      updatedAt: null,
    });
  });

  it('updates content and writes an audit record in the same transaction', async () => {
    const updatedAt = new Date('2026-07-15T12:00:00.000Z');
    siteSetting.upsert.mockResolvedValue({
      key: 'page.home',
      updatedAt,
      value: DEFAULT_HOME_CONTENT,
    });

    await expect(
      service.updateHome(DEFAULT_HOME_CONTENT, 'actor-id'),
    ).resolves.toEqual({ content: DEFAULT_HOME_CONTENT, updatedAt });
    expect(siteSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'page.home' } }),
    );
    const [[auditCall]] = auditRecord.create.mock.calls as Array<
      [
        {
          data: { action: string; actorId: string; entityId: string };
        },
      ]
    >;
    expect(auditCall.data).toMatchObject({
      action: 'site-content.updated',
      actorId: 'actor-id',
      entityId: 'page.home',
    });
  });
});
