import { ResearchService } from './research.service';
import { PrismaService } from '../database/prisma.service';
import { ResearchDiscoveryService } from './research-discovery.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ResearchProfileSyncService } from './research-profile-sync.service';
import { RankingsService } from './rankings.service';
import { SettingsService } from '../settings/settings.service';
import { resolveService } from '../../test/resolve-service';

it('adds explicit founding designations without changing public profile ranks or titles', async () => {
  const profiles = [
    {
      id: 'founder',
      fullName: 'Founder',
      appointedRank: 'ADVISOR',
      earnedRank: null,
      roleTitle: 'Advisor',
      isAlumni: false,
    },
    {
      id: 'cofounder',
      fullName: 'Cofounder',
      appointedRank: null,
      earnedRank: null,
      roleTitle: 'Researcher',
      isAlumni: false,
    },
    {
      id: 'director',
      fullName: 'Director',
      appointedRank: null,
      earnedRank: null,
      roleTitle: 'Founder & Research Director',
      isAlumni: false,
    },
  ];
  const prisma = {
    person: { findMany: jest.fn().mockResolvedValue(profiles) },
    foundingMember: {
      findMany: jest.fn().mockResolvedValue([
        { personId: 'founder', role: 'FOUNDER' },
        { personId: 'cofounder', role: 'CO_FOUNDER' },
      ]),
    },
  };
  const service = await resolveService(ResearchService, [
    { provide: ResearchDiscoveryService, useValue: {} },
    { provide: NotificationsService, useValue: {} },
    { provide: PrismaService, useValue: prisma },
    { provide: ResearchProfileSyncService, useValue: {} },
    { provide: RankingsService, useValue: {} },
    { provide: SettingsService, useValue: {} },
  ]);
  const people = await service.people();
  expect(people).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'founder',
        rank: 'ADVISOR',
        roleTitle: 'Advisor',
        isFounder: true,
        isCofounder: false,
      }),
      expect.objectContaining({
        id: 'cofounder',
        isFounder: false,
        isCofounder: true,
      }),
      expect.objectContaining({
        id: 'director',
        isFounder: false,
        isCofounder: false,
      }),
    ]),
  );
  expect(prisma.person.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        isPublished: true,
        OR: [{ userId: null }, { user: { is: { isDeleted: false } } }],
      },
    }),
  );
  prisma.foundingMember.findMany.mockResolvedValue([]);
  expect(await service.people()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'founder', isFounder: false }),
    ]),
  );
});
