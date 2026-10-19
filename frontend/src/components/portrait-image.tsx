"use client";

import Image from "next/image";
import { useState } from "react";

export function PortraitImage({
  src,
  initials,
  priority,
  sizes,
}: {
  src: string;
  initials: string;
  priority: boolean;
  sizes: string;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span>{initials}</span>
  ) : (
    <Image
      alt=""
      fill
      src={src}
      sizes={sizes}
      fetchPriority={priority ? "high" : "auto"}
      loading={priority ? "eager" : "lazy"}
      className="object-cover object-top"
      onError={() => setFailed(true)}
    />
  );
}
