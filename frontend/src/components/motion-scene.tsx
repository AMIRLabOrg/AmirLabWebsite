import Image from "next/image";
import { cn } from "@/lib/cn";

type SceneVariant = "about" | "dataset" | "department" | "home" | "paper" | "people" | "project";

const SCENES: Record<SceneVariant, string> = {
  about: "/illustrations/about-mission.svg",
  dataset: "/illustrations/dataset-lineage.svg",
  department: "/illustrations/department-network.svg",
  home: "/illustrations/home-research-flow.svg",
  paper: "/illustrations/paper-publication-evidence.svg",
  people: "/illustrations/people-collaboration.svg",
  project: "/illustrations/project-research-loop.svg",
};

export function MotionScene({ className, variant = "home" }: { className?: string; variant?: SceneVariant }) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={cn("pointer-events-none object-contain", className)}
      height={520}
      priority={variant === "home" || variant === "about"}
      src={SCENES[variant]}
      unoptimized
      width={900}
    />
  );
}
