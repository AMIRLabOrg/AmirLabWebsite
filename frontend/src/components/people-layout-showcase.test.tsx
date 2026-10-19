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
    isFounder: true,
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

it("keeps founding designations independent of rank and title, without duplicate people", () => {
  const person = {
    id: "founder",
    slug: "founder",
    fullName: "Original Founder",
    roleTitle: "Advisor",
    rank: "ADVISOR",
    isFounder: true,
    avatar: null,
  } as Person;
  const cofounder = {
    ...person,
    id: "cofounder",
    slug: "cofounder",
    fullName: "Lab Co-founder",
    isFounder: false,
    isCofounder: true,
  };
  const director = {
    ...person,
    id: "director",
    slug: "director",
    fullName: "Current Director",
    isFounder: false,
    roleTitle: "Research Director",
  };
  render(<PeopleDirectory people={[person, cofounder, director]} />);
  expect(screen.getByRole("heading", { name: "Founder" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Co-Founder" })).toBeTruthy();
  expect(screen.getAllByText("Original Founder")).toHaveLength(1);
  expect(screen.getAllByText("Lab Co-founder")).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "Advisors" })).toBeTruthy();
});

it("does not claim a founder or co-founder section while people are loading", () => {
  render(<PeopleDirectory loading />);
  expect(screen.queryByRole("heading", { name: /founder/i })).toBeNull();
});
