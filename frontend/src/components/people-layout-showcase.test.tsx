import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PeopleDirectory } from "./people-layout-showcase";
import type { Person } from "@/lib/types";

afterEach(cleanup);

it("moves an unranked person between Others and Alumni using membership status", () => {
  const person: Person = {
    id: "person-1",
    slug: "developer",
    fullName: "Lab Developer",
    headline: null,
    biography: null,
    contactAddress: null,
    phone: null,
    rank: null,
    roleTitle: "Alumni",
    expertise: [],
    isAlumni: false,
    avatar: null,
  };
  const view = render(<PeopleDirectory people={[person]} />);
  expect(screen.getByRole("heading", { name: "Others" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Members" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Alumni" })).toBeNull();
  view.rerender(<PeopleDirectory people={[{ ...person, isAlumni: true }]} />);
  expect(screen.getByRole("heading", { name: "Alumni" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Others" })).toBeNull();
});

it.each([
  "Professor & Head | Department | University",
  "Professor and department head",
])("keeps the whole founder headline emphasized: %s", (headline) => {
  const person = {
    id: "founder-1",
    slug: "founder",
    fullName: "Lab Founder",
    roleTitle: "Founder & Research Director",
    headline,
    isAlumni: false,
    rank: null,
    biography: null,
    avatar: null,
  } as Person;
  render(<PeopleDirectory people={[person]} />);
  const line = screen.getByText(headline);
  expect(line.textContent).toBe(headline);
  expect(line.classList.contains("font-semibold")).toBe(true);
});
