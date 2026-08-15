"use client";

import { API_URL } from "./api";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const headers = new Headers(init.headers);
  const csrfToken = sessionStorage.getItem("amirl_csrf");
  if (csrfToken && !["GET", "HEAD"].includes(init.method ?? "GET")) {
    headers.set("x-csrf-token", csrfToken);
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : `Request failed with status ${response.status}`;
    throw new ApiRequestError(message, response.status);
  }
  return payload as T;
}
