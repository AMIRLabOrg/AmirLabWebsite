import assert from 'node:assert/strict';
import test from 'node:test';
import { readSeedData, validateSeedData } from '../scripts/seed-data';

void test('canonical seed explicitly selects Mridha independently of rank and title', async () => {
  const seed = await readSeedData();
  assert.deepEqual(seed.foundingMembers, [
    {
      personSourceId: 'peopleDetailsView/Dr-Mohammad-Firoz-Mridha',
      role: 'FOUNDER',
    },
  ]);
  seed.people.forEach((person) => {
    person.roleTitle = null;
  });
  assert.doesNotThrow(() => validateSeedData(seed));
});

void test('seed rejects duplicate founders, repeated people, invalid roles and missing people', async () => {
  const seed = await readSeedData();
  const founder = seed.foundingMembers[0];
  const other = seed.people.find(
    (person) => person.sourceId !== founder.personSourceId,
  )!;
  for (const members of [
    [founder, { personSourceId: other.sourceId, role: 'FOUNDER' }],
    [founder, { ...founder, role: 'CO_FOUNDER' }],
    [{ ...founder, role: 'ADVISOR' }],
    [{ ...founder, personSourceId: 'missing-person' }],
  ]) {
    assert.throws(() =>
      validateSeedData({ ...seed, foundingMembers: members } as typeof seed),
    );
  }
  assert.doesNotThrow(() =>
    validateSeedData({
      ...seed,
      foundingMembers: [
        founder,
        { personSourceId: other.sourceId, role: 'CO_FOUNDER' },
      ],
    }),
  );
});
