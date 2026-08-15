import type { AboutContentDto, HomeContentDto } from './dto/site-content.dto';

export const DEFAULT_HOME_CONTENT: HomeContentDto = {
  establishment:
    'Est. 2020 · Dhaka, Bangladesh · Non-Profit Academic Consortium',
  heroTitle: 'Artificial intelligence for real-world problems.',
  heroIntroduction:
    'AMIR Lab develops machine learning and artificial intelligence solutions across healthcare, education, climate, transportation, and other practical challenges.',
  primaryCtaLabel: 'Explore research',
  secondaryCtaLabel: 'Meet the team',
  latestEyebrow: 'Latest work',
  latestTitle: 'Verified research outputs',
  recruitmentEyebrow: 'Open positions',
  recruitmentTitle: "We're looking for curious minds.",
  recruitmentBody:
    'Research roles, internships, and collaborative opportunities for people interested in practical machine intelligence.',
};

export const DEFAULT_ABOUT_CONTENT: AboutContentDto = {
  eyebrow: 'About AmirLab',
  title: 'Machine intelligence, grounded in real problems.',
  introduction:
    'Advanced Machine Intelligence Research Lab (AmirLab) is a non-profit academic research consortium based in Dhaka, Bangladesh. We connect research, people, and evidence around practical applications of artificial intelligence.',
  missionTitle: 'Research that can be examined, connected, and used.',
  missionBody:
    'Our work begins with a real problem and stays connected to its evidence. Papers, datasets, projects, and contributors are reviewed as related research records so visitors can understand both the result and the people behind it.',
  focusTitle: 'Where we apply machine intelligence',
  focusAreas: [
    'Healthcare',
    'Education',
    'Climate',
    'Transportation',
    'Computer vision',
    'Natural language processing',
  ],
  organizationTitle: 'An academic consortium built for collaboration.',
  organizationBody:
    'AmirLab brings together researchers at different career stages and supports collaboration across institutions. Membership, research claims, and published records are verified before they become part of the public site.',
  facts: [
    { label: 'Established', value: '2020' },
    { label: 'Based in', value: 'Dhaka, Bangladesh' },
    { label: 'Organization', value: 'Non-profit academic consortium' },
  ],
  closingTitle: 'Work with AmirLab',
  closingBody:
    'Explore current research, meet the people doing the work, or apply through an open position to join the consortium.',
};
