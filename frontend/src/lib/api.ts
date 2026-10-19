import type {
  Person,
  PublicationResponse,
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

import "server-only";
import { connection } from "next/server";
import { publicJson, PublicApiError } from "./public-cache";

async function getCollection<T>(path: string, live = false): Promise<T[]> {
  try {
    return await publicJson<T[]>(path, live);
  } catch (error) {
    await connection();
    console.error(`Unable to load ${path}`, error);
    return [];
  }
}

export function getPeople(): Promise<Person[]> {
  return getCollection<Person>("/people");
}

export async function getPerson(slug: string): Promise<Person | null> {
  try {
    return await publicJson<Person>(`/people/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) return null;
    await connection();
    console.error(`Unable to load person ${slug}`, error);
    return null;
  }
}

export function getPositions(): Promise<Position[]> {
  return getCollection<Position>("/positions", true);
}

export function getResearch(
  type?: ResearchItemType,
  limit?: number,
): Promise<ResearchItem[]> {
  const query = new URLSearchParams();
  if (type) query.set("type", type);
  if (limit !== undefined) query.set("limit", String(limit));
  return getCollection<ResearchItem>(
    `/research${query.size ? `?${query}` : ""}`,
  );
}

export async function getPublications(): Promise<
  PublicationResponse | undefined
> {
  try {
    return await publicJson<PublicationResponse>(
      "/publications?page=1&pageSize=12&sort=NEWEST",
    );
  } catch (error) {
    await connection();
    console.error("Unable to load publications", error);
    return undefined;
  }
}

export function getDepartments(): Promise<Department[]> {
  return getCollection<Department>("/departments");
}

export function getUniversities(): Promise<University[]> {
  return getCollection<University>("/universities");
}

export async function getDepartment(slug: string): Promise<Department | null> {
  try {
    return await publicJson<Department>(
      `/departments/${encodeURIComponent(slug)}`,
    );
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) return null;
    await connection();
    console.error(`Unable to load department ${slug}`, error);
    return null;
  }
}

export async function getResearchItem(
  slug: string,
): Promise<ResearchItem | null> {
  try {
    return await publicJson<ResearchItem>(
      `/research/${encodeURIComponent(slug)}`,
    );
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) return null;
    await connection();
    console.error(`Unable to load research item ${slug}`, error);
    return null;
  }
}

export async function getPublicStats(): Promise<PublicStats> {
  // The minute-long data cache must not shorten the homepage's static shell.
  await connection();
  try {
    return await publicJson<PublicStats>("/stats", false, 60);
  } catch (error) {
    await connection();
    console.error("Unable to load public statistics", error);
    return { papers: 0, people: 0, datasets: 0, projects: 0, openPositions: 0 };
  }
}

async function getSiteContent<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await publicJson<SiteContentResponse<T>>(
      `/site-content/${path}`,
    );
    return response.content;
  } catch (error) {
    await connection();
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
