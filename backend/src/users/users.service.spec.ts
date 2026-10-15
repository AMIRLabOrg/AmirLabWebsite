import { AccountStatus, PlatformRole } from '../../generated/prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { resolveService } from '../../test/resolve-service';
import { UserQueryDto } from './dto/user-query.dto';
import { UsersService } from './users.service';

describe('UsersService profile publication', () => {
  it('blocks deleting or demoting the last administrator inside the transaction', async () => {
    const administrator = {
      id: 'admin-id',
      email: 'admin@example.org',
      role: PlatformRole.ADMIN,
      isDeleted: false,
      status: AccountStatus.ACTIVE,
      person: null,
    };
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: {
        findUnique: jest.fn().mockResolvedValue(administrator),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
      auditRecord: { create: jest.fn() },
      session: { deleteMany: jest.fn() },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(administrator) },
      $transaction: (run: (tx: typeof transaction) => Promise<unknown>) =>
        run(transaction),
    };
    const service = await resolveService(UsersService, [
      { provide: AuthService, useValue: {} },
      { provide: PrismaService, useValue: prisma },
    ]);
    await expect(service.remove('admin-id', 'actor-id')).rejects.toThrow(
      'last administrator',
    );
    await expect(
      service.update(
        'admin-id',
        {
          email: administrator.email,
          fullName: 'Admin',
          role: PlatformRole.MEMBER,
        },
        'actor-id',
      ),
    ).rejects.toThrow('last administrator');
    expect(transaction.user.update).not.toHaveBeenCalled();
  });

  it('publishes an admin-created profile while its account setup stays pending', async () => {
    let createArgs: unknown;
    const personCreate = jest.fn((input: unknown) => {
      createArgs = input;
      return Promise.resolve({});
    });
    const account = {
      id: 'account-id',
      email: 'lab@example.org',
      status: AccountStatus.PENDING_SETUP,
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: (run: (transaction: unknown) => Promise<unknown>) =>
        run({
          user: { create: jest.fn().mockResolvedValue(account) },
          person: { create: personCreate },
        }),
    };
    const service = await resolveService(UsersService, [
      { provide: AuthService, useValue: {} },
      { provide: PrismaService, useValue: prisma },
    ]);

    await service.create({
      email: 'lab@example.org',
      fullName: 'Lab Member',
      role: PlatformRole.MEMBER,
    });

    expect(createArgs).toMatchObject({
      data: {
        fullName: 'Lab Member',
        isPublished: true,
      },
    });
    expect(account.status).toBe(AccountStatus.PENDING_SETUP);
  });

  it('returns profile publication separately from account status in the admin list', async () => {
    let listArgs: unknown;
    const prisma = {
      user: {
        findMany: jest.fn((input: unknown) => {
          listArgs = input;
          return Promise.resolve([
            {
              id: 'account-id',
              email: 'lab@example.org',
              role: PlatformRole.MEMBER,
              status: AccountStatus.PENDING_SETUP,
              isDeleted: false,
              deletedAt: null,
              setupEmailQueuedAt: null,
              person: {
                fullName: 'Lab Member',
                appointedRank: null,
                earnedRank: null,
                slug: 'lab-member',
                isPublished: true,
              },
            },
          ]);
        }),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const service = await resolveService(UsersService, [
      { provide: AuthService, useValue: {} },
      { provide: PrismaService, useValue: prisma },
    ]);

    await service.list(new UserQueryDto());

    expect(listArgs).toMatchObject({
      select: { person: { select: { isPublished: true } } },
    });
  });

  it('publishes a missing profile created while an admin edits an account', async () => {
    let createArgs: unknown;
    const prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'account-id',
            email: 'lab@example.org',
            role: PlatformRole.MEMBER,
            isDeleted: false,
            person: null,
          })
          .mockResolvedValueOnce(null),
      },
      $transaction: (run: (transaction: unknown) => Promise<unknown>) =>
        run({
          $queryRaw: jest.fn(),
          user: {
            findUnique: jest
              .fn()
              .mockResolvedValue({ role: 'MEMBER', isDeleted: false }),
            update: jest.fn().mockResolvedValue({
              id: 'account-id',
              email: 'lab@example.org',
              role: PlatformRole.MEMBER,
              status: AccountStatus.PENDING_SETUP,
            }),
          },
          person: {
            create: jest.fn((input: unknown) => {
              createArgs = input;
              return Promise.resolve({});
            }),
          },
          session: { updateMany: jest.fn() },
          auditRecord: { create: jest.fn().mockResolvedValue({}) },
        }),
    };
    const service = await resolveService(UsersService, [
      { provide: AuthService, useValue: {} },
      { provide: PrismaService, useValue: prisma },
    ]);

    await service.update(
      'account-id',
      {
        email: 'lab@example.org',
        fullName: 'Lab Member',
        role: PlatformRole.MEMBER,
        rank: undefined,
      },
      'admin-id',
    );

    expect(createArgs).toMatchObject({ data: { isPublished: true } });
  });
  it.each([true, false, undefined])(
    'saves alumni status independently of rank (%s)',
    async (isAlumni) => {
      const personUpdate = jest.fn();
      const transaction = {
        $queryRaw: jest.fn(),
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ role: 'MEMBER', isDeleted: false }),
          update: jest.fn().mockResolvedValue({ id: 'account-id' }),
        },
        person: { update: personUpdate },
        auditRecord: { create: jest.fn() },
      };
      const service = await resolveService(UsersService, [
        { provide: AuthService, useValue: {} },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'account-id',
                email: 'lab@example.org',
                person: { id: 'person-id' },
              }),
            },
            $transaction: (run: (tx: typeof transaction) => Promise<unknown>) =>
              run(transaction),
          },
        },
      ]);
      await service.update(
        'account-id',
        {
          email: 'lab@example.org',
          fullName: 'Lab Member',
          role: PlatformRole.MEMBER,
          isAlumni,
        },
        'admin-id',
      );
      expect(personUpdate).toHaveBeenCalledWith({
        where: { id: 'person-id' },
        data: { fullName: 'Lab Member', appointedRank: undefined, isAlumni },
      });
    },
  );
});
