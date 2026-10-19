import { afterEach, expect, test, vi } from "vitest";
import { renderToString } from "react-dom/server";
import Home from "@/app/(public)/page";
import About from "@/app/(public)/about/page";
import PeopleLoading from "@/app/(public)/people/loading";
import PapersLoading from "@/app/(public)/papers/loading";
import ProjectsLoading from "@/app/(public)/projects/loading";
import DatasetsLoading from "@/app/(public)/datasets/loading";
import DepartmentsLoading from "@/app/(public)/departments/loading";

// A cache miss can leave every public query pending. Loading views must not
// need those queries to resolve before rendering their existing placeholders.
vi.mock("@/lib/api", () => {
  const pending = () => new Promise(() => {});
  return {
    getHomeContent: pending,
    getAboutContent: pending,
    getPeople: pending,
    getDepartments: pending,
    getResearch: pending,
    getPublications: pending,
    getPositions: pending,
    getPublicStats: pending,
    getUniversities: pending,
  };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.unstubAllEnvs());

test.each([
  ["home", Home],
  ["about", About],
  ["people", PeopleLoading],
  ["papers", PapersLoading],
  ["projects", ProjectsLoading],
  ["datasets", DatasetsLoading],
  ["departments", DepartmentsLoading],
])(
  "%s retains its loading placeholders while cached queries are pending",
  (_name, View) => {
    vi.stubEnv("PUBLIC_CACHE_ENABLED", "true");
    expect(renderToString(<View />)).toContain('data-loading="true"');
  },
);

test.each([
  ["People behind the work", PeopleLoading],
  ["Publications", PapersLoading],
  ["Projects", ProjectsLoading],
  ["Datasets", DatasetsLoading],
  ["Departments", DepartmentsLoading],
])(
  "shows the known %s introduction before cached lists resolve",
  (title, View) => {
    const html = renderToString(<View />);
    expect(html).toMatch(
      new RegExp(
        `<h1(?![^>]*(?:aria-hidden|data-placeholder))[^>]*>${title}</h1>`,
      ),
    );
    expect(html).toContain('data-loading="true"');
  },
);
