import { notFound } from "next/navigation";
import { PersonProfileView } from "@/components/person-profile-view";
import { getPerson } from "@/lib/api";

export default async function PersonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const person = await getPerson(slug);
  if (!person) notFound();
  return <PersonProfileView person={person ?? undefined} />;
}
