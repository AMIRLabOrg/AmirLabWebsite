import type {
  Person,
  Position,
  PublicStats,
  AboutContent,
  Department,
  HomeContent,
  ResearchItem,
  ResearchItemType,
  SiteContentResponse,
  University,
} from "./types";
import { DEFAULT_ABOUT_CONTENT, DEFAULT_HOME_CONTENT } from "./site-content";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

async function getCollection<T>(
  path: string,
  options?: Pick<RequestInit, "cache" | "next">,
): Promise<T[]> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      ...(options?.cache === "no-store" ? {} : { next: { revalidate: 60 } }),
    });
    if (!response.ok) {
      throw new Error(`API returned ${response.status} for ${path}`);
    }
    return (await response.json()) as T[];
  } catch (error) {
    console.error(`Unable to load ${path}`, error);
    return [];
  }
}

export function getPeople(): Promise<Person[]> {
  return getCollection<Person>("/people");
}

export async function getPerson(slug: string): Promise<Person | null> {
  try {
    const response = await fetch(
      `${API_URL}/people/${encodeURIComponent(slug)}`,
      {
        next: { revalidate: 60 },
      },
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`API returned ${response.status} for person ${slug}`);
    }
    return (await response.json()) as Person;
  } catch (error) {
    console.error(`Unable to load person ${slug}`, error);
    return null;
  }
}

export function getPositions(): Promise<Position[]> {
  return getCollection<Position>("/positions", { cache: "no-store" });
}

export function getResearch(type?: ResearchItemType): Promise<ResearchItem[]> {
  const query = type ? `?type=${type}` : "";
  return getCollection<ResearchItem>(`/research${query}`);
}

export function getDepartments(): Promise<Department[]> {
  return getCollection<Department>("/departments");
}

export function getUniversities(): Promise<University[]> {
  return getCollection<University>("/universities");
}

export async function getDepartment(slug: string): Promise<Department | null> {
  try {
    const response = await fetch(
      `${API_URL}/departments/${encodeURIComponent(slug)}`,
      {
        next: { revalidate: 60 },
      },
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    return (await response.json()) as Department;
  } catch (error) {
    console.error(`Unable to load department ${slug}`, error);
    return null;
  }
}

export async function getResearchItem(
  slug: string,
): Promise<ResearchItem | null> {
  try {
    const response = await fetch(
      `${API_URL}/research/${encodeURIComponent(slug)}`,
      {
        next: { revalidate: 30 },
      },
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    return (await response.json()) as ResearchItem;
  } catch (error) {
    console.error(`Unable to load research item ${slug}`, error);
    return null;
  }
}

export async function getPublicStats(): Promise<PublicStats> {
  try {
    const response = await fetch(`${API_URL}/stats`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    return (await response.json()) as PublicStats;
  } catch (error) {
    console.error("Unable to load public statistics", error);
    return { papers: 0, people: 0, datasets: 0, projects: 0, openPositions: 0 };
  }
}

async function getSiteContent<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_URL}/site-content/${path}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    return ((await response.json()) as SiteContentResponse<T>).content;
  } catch (error) {
    console.error(`Unable to load ${path} site content`, error);
    return fallback;
  }
}

export function getHomeContent(): Promise<HomeContent> {
  return getSiteContent("home", DEFAULT_HOME_CONTENT);
}

export function getAboutContent(): Promise<AboutContent> {
  return getSiteContent("about", DEFAULT_ABOUT_CONTENT);
}
