import { AcademicRank } from '../../generated/prisma/client';
import {
  DEFAULT_RANK_POLICY,
  earnedRank,
  effectiveRank,
} from './settings.service';

describe('research ranking policy', () => {
  it('requires papers and citations when Scholar data exists', () => {
    expect(earnedRank(20, 499, DEFAULT_RANK_POLICY)).toBe(
      AcademicRank.SENIOR_RESEARCHER,
    );
    expect(earnedRank(20, 500, DEFAULT_RANK_POLICY)).toBe(
      AcademicRank.LEAD_RESEARCHER,
    );
  });

  it('uses the paper threshold when no Scholar profile is available', () => {
    expect(earnedRank(3, null, DEFAULT_RANK_POLICY)).toBe(
      AcademicRank.SENIOR_RESEARCHER,
    );
  });

  it('keeps appointed and earned ranks separate and exposes the higher rank', () => {
    expect(
      effectiveRank(AcademicRank.ADVISOR, AcademicRank.LEAD_RESEARCHER),
    ).toBe(AcademicRank.ADVISOR);
    expect(
      effectiveRank(AcademicRank.RESEARCHER, AcademicRank.SENIOR_RESEARCHER),
    ).toBe(AcademicRank.SENIOR_RESEARCHER);
  });
});
