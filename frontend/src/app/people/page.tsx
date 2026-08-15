import type { Metadata } from "next";
import { PeoplePageView } from "@/components/people-page-view";
import { getPeople } from "@/lib/api";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage() {
  const people = await getPeople();
  return <PeoplePageView people={people} />;
}
