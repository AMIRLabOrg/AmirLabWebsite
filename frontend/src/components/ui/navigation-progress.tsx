"use client";

import NextTopLoader from "nextjs-toploader";

export function NavigationProgress() {
  return (
    <NextTopLoader
      color="var(--brand)"
      crawlSpeed={200}
      easing="ease"
      height={3}
      initialPosition={0.08}
      shadow="0 0 8px color-mix(in srgb, var(--brand) 45%, transparent)"
      showForHashAnchor={false}
      showSpinner={false}
      speed={220}
      zIndex={200}
    />
  );
}
