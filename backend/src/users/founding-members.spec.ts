import { validate } from 'class-validator';
import { FoundingMemberRole } from '../../generated/prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { resolveService } from '../../test/resolve-service';
import { FoundingMembersDto } from './dto/founding-members.dto';
import { UsersService } from './users.service';

const founderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const cofounderId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function fixture(count = 2) {
  const transaction = {
    person: { count: jest.fn().mockResolvedValue(count) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    foundingMember: {
      deleteMany: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
    },
    auditRecord: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: (run: (tx: typeof transaction) => Promise<unknown>) =>
      run(transaction),
    foundingMember: {
      findMany: jest.fn().mockResolvedValue([
        { personId: founderId, role: FoundingMemberRole.FOUNDER },
        { personId: cofounderId, role: FoundingMemberRole.CO_FOUNDER },
      ]),
    },
    person: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: founderId, fullName: 'Founder', isPublished: false },
        ]),
    },
  };
  const service = await resolveService(UsersService, [
    { provide: AuthService, useValue: {} },
    { provide: PrismaService, useValue: prisma },
  ]);
  return { service, transaction, prisma };
}

it('stores one founder slot and optional co-founders together with an audit record', async () => {
  const { service, transaction } = await fixture();
  const selection = { founderId, cofounderIds: [cofounderId] };
  await expect(service.setFoundingMembers(selection, 'actor')).resolves.toEqual(
    selection,
  );
  expect(transaction.foundingMember.deleteMany).toHaveBeenCalledWith({});
  expect(transaction.foundingMember.createMany).toHaveBeenCalledWith({
    data: [
      { personId: founderId, role: FoundingMemberRole.FOUNDER },
      { personId: cofounderId, role: FoundingMemberRole.CO_FOUNDER },
    ],
  });
  expect(transaction.auditRecord.create).toHaveBeenCalledWith({
    data: {
      actorId: 'actor',
      action: 'people.founding-members.updated',
      entityType: 'FoundingMember',
      entityId: 'founding-members',
      details: selection,
    },
  });
});

it('rejects overlapping designations and deleted or nonexistent people without writing', async () => {
  const { service, transaction } = await fixture(1);
  await expect(
    service.setFoundingMembers(
      { founderId, cofounderIds: [founderId] },
      'actor',
    ),
  ).rejects.toThrow('cannot also');
  await expect(
    service.setFoundingMembers(
      { founderId, cofounderIds: [cofounderId] },
      'actor',
    ),
  ).rejects.toThrow('non-deleted');
  expect(transaction.foundingMember.deleteMany).not.toHaveBeenCalled();
});

it('allows clearing all designations', async () => {
  const { service } = await fixture(0);
  await expect(
    service.setFoundingMembers({ founderId: null, cofounderIds: [] }, 'actor'),
  ).resolves.toEqual({ founderId: null, cofounderIds: [] });
});

it('keeps unpublished profiles selectable and removes dangling selections from the editor', async () => {
  const { service } = await fixture();
  await expect(service.foundingMembers()).resolves.toEqual({
    founderId,
    cofounderIds: [],
    people: [{ id: founderId, fullName: 'Founder', isPublished: false }],
  });
});

it.each([
  {},
  { founderId: [founderId], cofounderIds: [] },
  { founderId: null, cofounderIds: [cofounderId, cofounderId] },
  { founderId: null, cofounderIds: ['invalid'] },
])(
  'rejects malformed or duplicate IDs at the request boundary: %j',
  async (value) => {
    expect(
      await validate(Object.assign(new FoundingMembersDto(), value)),
    ).not.toHaveLength(0);
  },
);

it('validates an empty selection', async () => {
  expect(
    await validate(
      Object.assign(new FoundingMembersDto(), {
        founderId: null,
        cofounderIds: [],
      }),
    ),
  ).toHaveLength(0);
});
