import type { AboutContent, HomeContent } from "./types";

export const DEFAULT_HOME_CONTENT: HomeContent = {
  establishment:
    "Est. 2020 · Dhaka, Bangladesh · Non-profit academic consortium",
  heroTitle: "Advanced Machine Intelligence Research Lab.",
  heroIntroduction:
    "AMIR Lab is a Dhaka-based academic consortium conducting research in artificial intelligence, machine learning, computer vision, natural language processing, and related applications.",
  primaryCtaLabel: "Explore research",
  secondaryCtaLabel: "Meet the team",
  latestEyebrow: "Recent research",
  latestTitle: "Recent publications",
  recruitmentEyebrow: "Open positions",
  recruitmentTitle: "Research positions and internships",
  recruitmentBody:
    "View current AMIR Lab openings and apply directly with your CV.",
};

export const DEFAULT_ABOUT_CONTENT: AboutContent = {
  eyebrow: "About AMIR Lab",
  title: "Advanced Machine Intelligence Research Lab.",
  introduction:
    "Founded in 2020, Advanced Machine Intelligence Research Lab (AMIR Lab) is a non-profit academic consortium based in Dhaka, Bangladesh. Its members include researchers and collaborators from universities and industry.",
  missionTitle: "Research, development, and researcher training in AI.",
  missionBody:
    "AMIR Lab works on interdisciplinary artificial intelligence research, develops practical systems, supports researcher education, and promotes responsible research practice.",
  focusTitle: "Research areas",
  focusAreas: [
    "Artificial intelligence",
    "Machine learning",
    "Computer vision",
    "Natural language processing",
    "Healthcare",
    "Agriculture",
    "Security",
    "Education",
  ],
  organizationTitle: "Researchers across institutions and disciplines.",
  organizationBody:
    "The lab includes advisors, researchers, research assistants, interns, and administrative contributors working across research departments and partner institutions.",
  facts: [
    { label: "Established", value: "2020" },
    { label: "Based in", value: "Dhaka, Bangladesh" },
    { label: "Organization", value: "Non-profit academic consortium" },
  ],
  closingTitle: "Work with AMIR Lab",
  closingBody:
    "Explore current projects and publications, meet the research team, or apply for an open position.",
};
