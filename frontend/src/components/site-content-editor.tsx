"use client";

import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import {
  useEffect,
  useState,
  type SyntheticEvent,
  type ReactNode,
} from "react";
import { Plus, X } from "lucide-react";
import { useNotifications } from "@/components/notification-provider";
import { StatePanel } from "@/components/state-panel";
import { InputControl, TextareaControl } from "@/components/ui/form-controls";
import { apiRequest } from "@/lib/client-api";
import {
  DEFAULT_ABOUT_CONTENT,
  DEFAULT_HOME_CONTENT,
} from "@/lib/site-content";
import type {
  AboutContent,
  HomeContent,
  SiteContentResponse,
} from "@/lib/types";
import { ButtonControl, ButtonLink } from "@/components/ui/button-control";
import {
  WorkspaceHero,
  WorkspacePanel,
  WorkspaceRuleBand,
} from "@/components/ui/workspace-surface";

import { WorkspaceBackLink } from "@/components/workspace-record";

export type SiteContentPage = "about" | "home";
type EditableContent = AboutContent | HomeContent;

export function SiteContentEditor({ page }: { page: SiteContentPage }) {
  const { showToast } = useNotifications();
  const [content, setContent] = useState<EditableContent>(
    page === "home" ? DEFAULT_HOME_CONTENT : DEFAULT_ABOUT_CONTENT,
  );
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    void apiRequest<SiteContentResponse<EditableContent>>(
      `/site-content/${page}`,
      { method: "GET" },
    )
      .then((result) => {
        if (!active) return;
        setContent(result.content);
        setUpdatedAt(result.updatedAt);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load site content.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, reload]);

  function update(key: string, value: unknown) {
    setContent((current) => ({ ...current, [key]: value }) as EditableContent);
  }

  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const result = await apiRequest<SiteContentResponse<EditableContent>>(
        `/site-content/${page}`,
        {
          body: JSON.stringify(content),
          headers: { "content-type": "application/json" },
          method: "PUT",
        },
      );
      setContent(result.content);
      setUpdatedAt(result.updatedAt);
      showToast({
        body: `The public ${page} content now uses this saved version.`,
        title: `${page === "home" ? "Home" : "About"} page updated`,
      });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to save content.";
      setError(message);
      showToast({
        body: message,
        title: "Content was not saved",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid w-full gap-0">
      <WorkspaceBackLink href="/workspace/content">
        Site content
      </WorkspaceBackLink>
      {error && !updatedAt && !loading ? (
        <StatePanel
          frame="workspace"
          action={{
            label: "Retry",
            onClick: () => {
              setLoading(true);
              setReload((value) => value + 1);
            },
          }}
          body="The content record could not be retrieved."
          title={`Could not load ${page === "home" ? "home" : "about"} content`}
          variant="error"
        />
      ) : null}
      {!(error && !updatedAt && !loading) ? (
        <form
          aria-busy={loading}
          className="grid gap-0"
          data-loading={loading || undefined}
          onSubmit={submit}
        >
          <WorkspaceHero
            eyebrow="Public content"
            title={page === "home" ? "Home page" : "About page"}
            description="Text updates publish directly. Research lists, people, positions, and statistics remain connected to their verified records."
            loading={loading}
            action={
              <span
                className={cn(
                  "whitespace-nowrap rounded-small border border-line bg-surface-subtle px-3 py-2 font-mono text-[.62rem] text-ink-muted",
                  loadingPlaceholder(loading, "label", "medium"),
                )}
                data-placeholder={loading ? "label" : undefined}
                data-placeholder-width="medium"
              >
                {updatedAt
                  ? `Last saved ${new Date(updatedAt).toLocaleString()}`
                  : loading
                    ? "Loading saved state"
                    : "Using designed defaults"}
              </span>
            }
          />

          {page === "home" ? (
            <HomeFields
              content={content as HomeContent}
              loading={loading}
              update={update}
            />
          ) : (
            <AboutFields
              content={content as AboutContent}
              loading={loading}
              update={update}
            />
          )}

          {error && updatedAt ? (
            <p className="text-[.75rem] text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <WorkspaceRuleBand contentClassName="flex flex-wrap items-center justify-end gap-3 py-4">
            <ButtonLink
              href={page === "home" ? "/" : "/about"}
              rel="noreferrer"
              target="_blank"
            >
              Preview public page
            </ButtonLink>
            <ButtonControl
              disabled={loading || saving}
              loading={loading}
              busy={saving}
              variant="primary"
              type="submit"
            >
              Publish content
            </ButtonControl>
          </WorkspaceRuleBand>
        </form>
      ) : null}
    </div>
  );
}

function HomeFields({
  content,
  loading,
  update,
}: {
  content: HomeContent;
  loading: boolean;
  update: (key: string, value: unknown) => void;
}) {
  return (
    <>
      <EditorSection eyebrow="Hero" title="Opening statement">
        <TextField
          loading={loading}
          label="Establishment line"
          maxLength={180}
          name="establishment"
          onChange={update}
          value={content.establishment}
        />
        <TextField
          loading={loading}
          label="Hero title"
          maxLength={180}
          name="heroTitle"
          onChange={update}
          value={content.heroTitle}
        />
        <TextField
          loading={loading}
          area
          label="Introduction"
          maxLength={800}
          name="heroIntroduction"
          onChange={update}
          value={content.heroIntroduction}
        />
        <div className="col-span-2 grid grid-cols-2 gap-4 max-[640px]:col-span-1 max-[640px]:grid-cols-1">
          <TextField
            loading={loading}
            label="Primary action label"
            maxLength={60}
            name="primaryCtaLabel"
            onChange={update}
            value={content.primaryCtaLabel}
          />
          <TextField
            loading={loading}
            label="Secondary action label"
            maxLength={60}
            name="secondaryCtaLabel"
            onChange={update}
            value={content.secondaryCtaLabel}
          />
        </div>
      </EditorSection>
      <EditorSection eyebrow="Research" title="Latest work heading">
        <div className="col-span-2 grid grid-cols-2 gap-4 max-[640px]:col-span-1 max-[640px]:grid-cols-1">
          <TextField
            loading={loading}
            label="Eyebrow"
            maxLength={80}
            name="latestEyebrow"
            onChange={update}
            value={content.latestEyebrow}
          />
          <TextField
            loading={loading}
            label="Section title"
            maxLength={140}
            name="latestTitle"
            onChange={update}
            value={content.latestTitle}
          />
        </div>
      </EditorSection>
      <EditorSection eyebrow="Recruitment" title="Open positions band">
        <TextField
          loading={loading}
          label="Eyebrow"
          maxLength={80}
          name="recruitmentEyebrow"
          onChange={update}
          value={content.recruitmentEyebrow}
        />
        <TextField
          loading={loading}
          label="Title"
          maxLength={140}
          name="recruitmentTitle"
          onChange={update}
          value={content.recruitmentTitle}
        />
        <TextField
          loading={loading}
          area
          label="Description"
          maxLength={600}
          name="recruitmentBody"
          onChange={update}
          value={content.recruitmentBody}
        />
      </EditorSection>
    </>
  );
}

function AboutFields({
  content,
  loading,
  update,
}: {
  content: AboutContent;
  loading: boolean;
  update: (key: string, value: unknown) => void;
}) {
  function updateFocus(index: number, value: string) {
    update(
      "focusAreas",
      content.focusAreas.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    );
  }

  function updateFact(index: number, key: "label" | "value", value: string) {
    update(
      "facts",
      content.facts.map((fact, itemIndex) =>
        itemIndex === index ? { ...fact, [key]: value } : fact,
      ),
    );
  }

  return (
    <>
      <EditorSection eyebrow="Hero" title="About AmirLab">
        <TextField
          loading={loading}
          label="Eyebrow"
          maxLength={80}
          name="eyebrow"
          onChange={update}
          value={content.eyebrow}
        />
        <TextField
          loading={loading}
          label="Page title"
          maxLength={220}
          name="title"
          onChange={update}
          value={content.title}
        />
        <TextField
          loading={loading}
          area
          label="Introduction"
          maxLength={1200}
          name="introduction"
          onChange={update}
          value={content.introduction}
        />
      </EditorSection>
      <EditorSection eyebrow="Mission" title="Purpose statement">
        <TextField
          loading={loading}
          label="Heading"
          maxLength={160}
          name="missionTitle"
          onChange={update}
          value={content.missionTitle}
        />
        <TextField
          loading={loading}
          area
          label="Body"
          maxLength={1600}
          name="missionBody"
          onChange={update}
          value={content.missionBody}
        />
      </EditorSection>
      <EditorSection eyebrow="Research focus" title="Areas of work">
        <TextField
          loading={loading}
          label="Heading"
          maxLength={160}
          name="focusTitle"
          onChange={update}
          value={content.focusTitle}
        />
        <div className="col-span-2 grid gap-[.65rem] max-[640px]:col-span-1">
          {content.focusAreas.map((area, index) => (
            <div
              className="grid grid-cols-[28px_minmax(0,1fr)_40px] items-center gap-[.65rem]"
              key={index}
            >
              <span className="font-mono text-[.6rem] text-ink-faint">
                {String(index + 1).padStart(2, "0")}
              </span>
              <InputControl
                placeholder={"e.g. Computer vision"}
                loading={loading}
                aria-label={`Focus area ${index + 1}`}
                maxLength={100}
                onChange={(event) => updateFocus(index, event.target.value)}
                required
                value={area}
              />
              {content.focusAreas.length > 2 ? (
                <ButtonControl
                  className="h-10 min-h-10 w-10 rounded-control bg-surface p-0 text-ink-muted hover:border-danger hover:bg-danger-soft hover:text-danger"
                  aria-label={`Remove focus area ${index + 1}`}
                  loading={loading}
                  onClick={() =>
                    update(
                      "focusAreas",
                      content.focusAreas.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    )
                  }
                  type="button"
                >
                  <X aria-hidden="true" size={16} />
                </ButtonControl>
              ) : (
                <span aria-hidden="true" className="h-10 w-10" />
              )}
            </div>
          ))}
          <ButtonControl
            className="justify-self-start"
            disabled={content.focusAreas.length >= 12}
            loading={loading}
            onClick={() => update("focusAreas", [...content.focusAreas, ""])}
            type="button"
            variant="add-another"
          >
            <Plus aria-hidden="true" size={16} /> Add another focus area
          </ButtonControl>
        </div>
      </EditorSection>
      <EditorSection eyebrow="Organization" title="Consortium description">
        <TextField
          loading={loading}
          label="Heading"
          maxLength={160}
          name="organizationTitle"
          onChange={update}
          value={content.organizationTitle}
        />
        <TextField
          loading={loading}
          area
          label="Body"
          maxLength={1600}
          name="organizationBody"
          onChange={update}
          value={content.organizationBody}
        />
        <div className="col-span-2 grid gap-[.65rem] max-[640px]:col-span-1">
          {content.facts.map((fact, index) => (
            <div
              className="grid grid-cols-[28px_minmax(120px,.55fr)_minmax(180px,1fr)_40px] items-center gap-[.65rem] max-[760px]:grid-cols-[28px_minmax(0,1fr)_40px]"
              key={index}
            >
              <span className="font-mono text-[.6rem] text-ink-faint">
                {String(index + 1).padStart(2, "0")}
              </span>
              <InputControl
                placeholder={"e.g. Established"}
                loading={loading}
                aria-label={`Fact ${index + 1} label`}
                maxLength={60}
                onChange={(event) =>
                  updateFact(index, "label", event.target.value)
                }
                required
                value={fact.label}
              />
              <InputControl
                placeholder={"e.g. 2020"}
                loading={loading}
                aria-label={`Fact ${index + 1} value`}
                className="max-[760px]:col-start-2 max-[760px]:row-start-2"
                maxLength={160}
                onChange={(event) =>
                  updateFact(index, "value", event.target.value)
                }
                required
                value={fact.value}
              />
              {content.facts.length > 2 ? (
                <ButtonControl
                  className="h-10 min-h-10 w-10 rounded-control bg-surface p-0 text-ink-muted hover:border-danger hover:bg-danger-soft hover:text-danger max-[760px]:col-start-3 max-[760px]:row-start-1"
                  aria-label={`Remove fact ${index + 1}`}
                  loading={loading}
                  onClick={() =>
                    update(
                      "facts",
                      content.facts.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    )
                  }
                  type="button"
                >
                  <X aria-hidden="true" size={16} />
                </ButtonControl>
              ) : (
                <span aria-hidden="true" className="h-10 w-10" />
              )}
            </div>
          ))}
          <ButtonControl
            className="justify-self-start"
            disabled={content.facts.length >= 8}
            loading={loading}
            onClick={() =>
              update("facts", [...content.facts, { label: "", value: "" }])
            }
            type="button"
            variant="add-another"
          >
            <Plus aria-hidden="true" size={16} /> Add another fact
          </ButtonControl>
        </div>
      </EditorSection>
      <EditorSection eyebrow="Closing" title="Invitation to engage">
        <TextField
          loading={loading}
          label="Heading"
          maxLength={160}
          name="closingTitle"
          onChange={update}
          value={content.closingTitle}
        />
        <TextField
          loading={loading}
          area
          label="Body"
          maxLength={800}
          name="closingBody"
          onChange={update}
          value={content.closingBody}
        />
      </EditorSection>
    </>
  );
}

function EditorSection({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <WorkspacePanel eyebrow={eyebrow} title={title}>
      <div className="grid min-w-0 grid-cols-2 gap-4 px-[var(--workspace-gutter)] py-5 max-[640px]:grid-cols-1">
        {children}
      </div>
    </WorkspacePanel>
  );
}

function TextField({
  area = false,
  label,
  loading = false,
  maxLength,
  name,
  onChange,
  value,
}: {
  area?: boolean;
  label: string;
  loading?: boolean;
  maxLength: number;
  name: string;
  onChange: (key: string, value: string) => void;
  value: string;
}) {
  const id = `site-content-${name}`;
  return (
    <div
      className={cn(
        "grid gap-[.45rem]",
        area && "col-span-2 max-[640px]:col-span-1",
      )}
    >
      <label
        className="text-[.78rem] font-semibold tracking-[.04em]"
        htmlFor={id}
      >
        {label}
      </label>
      {area ? (
        <TextareaControl
          placeholder={`Write the ${label.toLowerCase()}`}
          loading={loading}
          className="min-h-[130px]"
          id={id}
          maxLength={maxLength}
          onChange={(event) => onChange(name, event.target.value)}
          required
          value={value}
        />
      ) : (
        <InputControl
          placeholder={`Enter the ${label.toLowerCase()}`}
          loading={loading}
          id={id}
          maxLength={maxLength}
          onChange={(event) => onChange(name, event.target.value)}
          required
          value={value}
        />
      )}
      <p
        className={cn(
          "text-[.68rem] leading-[1.45] text-ink-muted",
          loadingPlaceholder(loading, "label", "short"),
        )}
        data-placeholder={loading ? "label" : undefined}
      >
        {value.length} / {maxLength}
      </p>
    </div>
  );
}
