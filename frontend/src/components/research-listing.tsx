import { getResearch } from "@/lib/api";
import type { ResearchItem, ResearchItemType } from "@/lib/types";
import { PageIntro } from "./page-intro";
import { PaperCard } from "./paper-card";
import { ResearchCard } from "./research-card";
import { StatePanel } from "./state-panel";
import { CollectionHeading, PublicSection } from "@/components/ui/public-shell";

type ResearchListingProps = {
  type: ResearchItemType;
  eyebrow: string;
  title: string;
  description: string;
};

export async function ResearchListing(props: ResearchListingProps) {
  const items = await getResearch(props.type);
  return <ResearchListingView {...props} items={items} />;
}

export function ResearchListingView({
  type,
  eyebrow,
  title,
  description,
  items,
  loading = false,
}: ResearchListingProps & { items?: ResearchItem[]; loading?: boolean }) {
  const list = items ?? [];
  const isDataset = type === "DATASET";
  const visibleItems: Array<ResearchItem | undefined> = loading
    ? Array.from({ length: 6 }, () => undefined)
    : list;

  return (
    <>
      <PageIntro
        scene={isDataset ? "dataset" : "project"}
        loading={loading}
        eyebrow={eyebrow}
        meta={
          <>
            <span>
              {list.length}{" "}
              {list.length === 1 ? "public entry" : "public entries"}
            </span>
            <span>Source links where available</span>
          </>
        }
        title={title}
      >
        {description}
      </PageIntro>

      <PublicSection
        aria-busy={loading || undefined}
        contentClassName="grid pt-8 pb-20 max-[640px]:pt-[1.4rem] max-[640px]:pb-16"
        data-loading={loading || undefined}
        aria-label={title}
      >
        <div className="min-w-0">
          <CollectionHeading
            eyebrow={isDataset ? "Datasets" : "Projects"}
            title={
              isDataset
                ? "Available research resources"
                : "Current and completed work"
            }
            count={list.length}
            loading={loading}
          />
          {visibleItems.length ? (
            <div className="grid">
              {visibleItems.map((item, index) =>
                type === "PAPER" || type === "DATASET" ? (
                  <PaperCard
                    frame
                    item={item}
                    key={item?.id ?? `loading-${index}`}
                    loading={loading}
                  />
                ) : (
                  <ResearchCard
                    frame
                    item={item}
                    key={item?.id ?? `loading-${index}`}
                    loading={loading}
                    variant="index"
                  />
                ),
              )}
            </div>
          ) : (
            <StatePanel
              body={`Published ${title.toLowerCase()} will appear here when available.`}
              frame
              title={`No ${title.toLowerCase()} published yet`}
            />
          )}
        </div>
      </PublicSection>
    </>
  );
}
