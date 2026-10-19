import type { Person } from "./types";

export type PeopleGroup =
  | "founder"
  | "cofounder"
  | "advisor"
  | "lead"
  | "senior"
  | "researcher"
  | "assistant"
  | "intern"
  | "alumni"
  | "other";

export function peopleGroup(person: Person): PeopleGroup {
  const role = person.roleTitle?.toLowerCase() ?? "";
  if (person.isFounder) return "founder";
  if (person.isCofounder) return "cofounder";
  if (person.isAlumni) return "alumni";
  if (person.rank === "ADVISOR" || role.includes("advisor")) return "advisor";
  if (person.rank === "LEAD_RESEARCHER") return "lead";
  if (person.rank === "SENIOR_RESEARCHER") return "senior";
  if (person.rank === "RESEARCHER") return "researcher";
  if (person.rank === "RESEARCH_ASSISTANT") return "assistant";
  if (person.rank === "RESEARCH_INTERN") return "intern";
  return "other";
}
