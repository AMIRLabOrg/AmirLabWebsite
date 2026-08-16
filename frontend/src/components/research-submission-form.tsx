"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { SelectControl } from "@/components/ui/select-control";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ButtonControl } from "@/components/ui/button-control";
import { InputControl, TextareaControl } from "@/components/ui/form-controls";
import { FormField, FormMessage } from "@/components/ui/form-field";
import { useAuth } from "@/components/auth-provider";
import { useNotifications } from "@/components/notification-provider";
import { WorkspaceRecord, WorkspaceRecordForm, WorkspaceRecordPanelHeader, WorkspaceRecordPanelTitle } from "@/components/workspace-record";
const researchOutputOptions = [
  { label: "Paper", value: "PAPER" },
  { label: "Dataset", value: "DATASET" },
];

export function ResearchSubmissionForm() {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const staff = Boolean(user && user.role !== "MEMBER");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [people, setPeople] = useState<Array<{ id: string; fullName: string; roleTitle: string | null; headline: string | null }>>();
  const [submitterPersonId, setSubmitterPersonId] = useState("");

  useEffect(() => {
    if (!staff) return;
    let active = true;
    void apiRequest<{ people: Array<{ id: string; fullName: string; roleTitle: string | null; headline: string | null }> }>("/projects/options", { method: "GET" })
      .then((result) => {
        if (active) setPeople(result.people);
      })
      .catch((caught) => {
        if (!active) return;
        setPeople([]);
        setError(caught instanceof Error ? caught.message : "Registered people could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [staff]);
  const loadingPeople = staff && people === undefined;
  const availablePeople = people ?? [];
  const effectiveSubmitterPersonId = staff ? submitterPersonId : (user?.person?.id ?? "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    if (staff && !effectiveSubmitterPersonId) {
      setError("Select the registered person this record is being submitted for.");
      setLoading(false);
      return;
    }
    const contributors = String(form.get("contributors") ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    if (!contributors.length) {
      setError("Add at least one contributor.");
      setLoading(false);
      return;
    }
    const type = form.get("type");
    try {
      const body: Record<string, unknown> = {
        canonicalUrl: form.get("canonicalUrl"),
        contributors,
        summary: form.get("summary") || undefined,
        title: form.get("title"),
        type,
        ...(staff ? { submitterPersonId: effectiveSubmitterPersonId } : {}),
      };
      await apiRequest<{ reviewStatus: string }>("/research", {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      event.currentTarget.reset();
      showToast({
        body: "The source and registered contributor matches are being checked before review.",
        title: staff ? "Research record submitted on behalf" : "Research output submitted",
      });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Submission failed.";
      setError(message);
      showToast({
        body: message,
        title: "Research output was not submitted",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <WorkspaceRecord
      backHref="/workspace/submissions"
      backLabel="Papers & datasets"
      description="Add a canonical public source before contributors are checked for registered-person matches."
      eyebrow="Paper or dataset"
      title={staff ? "New record on behalf" : "New research output"}
    >
      <WorkspaceRecordForm onSubmit={submit}>
        <WorkspaceRecordPanelHeader>
          <p className="m-0 font-sans text-[.65rem] font-semibold uppercase tracking-[.1em] text-brand">Source details</p>
          <WorkspaceRecordPanelTitle>Publication information</WorkspaceRecordPanelTitle>
        </WorkspaceRecordPanelHeader>
        {staff ? (
          <FormField label="Submit on behalf of">
            <SearchableSelect
              ariaLabel="Registered submitter"
              disabled={loadingPeople || loading}
              emptyMessage="No registered people found."
              onValueChange={setSubmitterPersonId}
              options={availablePeople.map((person) => ({
                description: person.roleTitle ?? person.headline ?? undefined,
                label: person.fullName,
                value: person.id,
              }))}
              placeholder={loadingPeople ? "Loading registered people…" : "Select registered member…"}
              searchPlaceholder="Search by name or role…"
              value={submitterPersonId}
            />
            <p className="m-0 text-[.82rem] leading-[1.5] text-ink-muted">Your staff account records the action. The selected member is recorded as the submitter, and the record still enters manual review.</p>
          </FormField>
        ) : null}
        <FormField htmlFor="research-type" label="Type">
          <SelectControl
            defaultValue="PAPER"
            id="research-type"
            name="type"
            options={researchOutputOptions}
            required
          />
        </FormField>
        <FormField htmlFor="research-title" label="Title">
          <InputControl id="research-title" name="title" required />
        </FormField>
        <FormField htmlFor="canonical-url" label="Canonical URL">
          <InputControl
            id="canonical-url"
            name="canonicalUrl"
            required
            type="url"
          />
          <p className="m-0 text-[.82rem] leading-[1.5] text-ink-muted">
            DOI, repository, or dataset page. No file is uploaded.
          </p>
        </FormField>
        <FormField htmlFor="contributors" label="Contributors">
          <InputControl id="contributors" name="contributors" required />
          <p className="m-0 text-[.82rem] leading-[1.5] text-ink-muted">Comma-separated, in publication order.</p>
        </FormField>
        <FormField htmlFor="research-summary" label="Summary">
          <TextareaControl id="research-summary" name="summary" />
        </FormField>
        {error ? <FormMessage>{error}</FormMessage> : null}
        <div className="flex flex-wrap justify-end gap-[.65rem] max-[700px]:justify-start">
          <ButtonControl disabled={loading || loadingPeople} type="submit" variant="primary">
            {loading ? "Saving…" : staff ? "Submit on behalf for review" : "Submit for review"}
          </ButtonControl>
        </div>
      </WorkspaceRecordForm>
    </WorkspaceRecord>
  );
}
