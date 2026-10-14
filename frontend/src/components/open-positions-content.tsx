"use client";

import { useState } from "react";
import { ApplicationForm } from "@/components/application-form";
import { ApplicationProcess } from "@/components/application-process";
import { PositionList } from "@/components/position-list";
import { PublicSection } from "@/components/ui/public-shell";
import type { Position } from "@/lib/types";

export function OpenPositionsContent({
  positions,
  loading = false,
}: {
  positions?: Position[];
  loading?: boolean;
}) {
  const list = positions ?? [];
  const [positionId, setPositionId] = useState("");
  return (
    <>
      <PositionList
        loading={loading}
        positions={list}
        onApply={setPositionId}
      />
      <PublicSection
        contentClassName="grid grid-cols-[minmax(0,1fr)_minmax(280px,360px)] items-start gap-[clamp(1.5rem,3vw,3rem)] pt-8 pb-16 max-[900px]:grid-cols-1"
        id="apply"
        className="scroll-mt-24"
      >
        <ApplicationForm
          loading={loading}
          positions={list}
          positionId={positionId}
          onPositionChange={setPositionId}
        />
        <div>
          <ApplicationProcess loading={loading} />
        </div>
      </PublicSection>
    </>
  );
}
