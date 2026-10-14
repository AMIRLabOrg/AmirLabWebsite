import { lockAdministratorChange } from './admin-change-lock';

describe('administrator changes', () => {
  it('checks the remaining administrator after acquiring the shared lock', async () => {
    let remaining = 1;
    const transaction = {
      $queryRaw: jest.fn(() => {
        remaining = 0;
        return Promise.resolve([]);
      }),
      user: {
        findUnique: jest.fn().mockResolvedValue({
          role: 'ADMIN',
          isDeleted: false,
          status: 'ACTIVE',
        }),
        count: jest.fn(() => Promise.resolve(remaining)),
      },
    };
    await expect(
      lockAdministratorChange(transaction as never, 'last-admin'),
    ).rejects.toThrow('The last administrator cannot be removed or demoted');
    expect(transaction.user.count).toHaveBeenCalledWith({
      where: {
        id: { not: 'last-admin' },
        isDeleted: false,
        role: 'ADMIN',
        status: { not: 'ARCHIVED' },
      },
    });
  });

  it('allows promotion without demanding another administrator', async () => {
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: { findUnique: jest.fn(), count: jest.fn() },
    };
    await lockAdministratorChange(transaction as never, 'member', false);
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transaction.user.count).not.toHaveBeenCalled();
  });
});
