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
