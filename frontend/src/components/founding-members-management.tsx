"use client";

import { useEffect, useState } from "react";
import { PersonPortrait } from "@/components/person-portrait";
import { AdminOnly } from "@/components/admin-only";
import { StatePanel } from "@/components/state-panel";
import { ButtonControl, ButtonLink } from "@/components/ui/button-control";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { IconButton } from "@/components/ui/icon-button";
import { FormField } from "@/components/ui/form-field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  WorkspaceHero,
  WorkspacePanel,
} from "@/components/ui/workspace-surface";
import { apiRequest } from "@/lib/client-api";

interface FoundingMembers {
  founderId: string | null;
  cofounderIds: string[];
  people: Array<{
    id: string;
    fullName: string;
    isPublished: boolean;
    avatar?: { id: string } | null;
  }>;
}

export function FoundingMembersManagement() {
  return (
    <AdminOnly>
      <FoundingMembersForm />
    </AdminOnly>
  );
}

function FoundingMembersForm() {
  const [data, setData] = useState<FoundingMembers>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [reload, setReload] = useState(0);
  const [cofounderId, setCofounderId] = useState("");
  const [removing, setRemoving] = useState<{
    id: string;
    name: string;
    founder: boolean;
  }>();

  useEffect(() => {
    let cancelled = false;
    apiRequest<FoundingMembers>("/users/founding-members", { method: "GET" })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setError(
            error instanceof Error
              ? error.message
              : "Unable to load founding members.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const founder = data?.people.find((person) => person.id === data.founderId);
  const cofounders =
    data?.people.filter((person) => data.cofounderIds.includes(person.id)) ??
    [];
  const candidates =
    data?.people.filter(
      (person) =>
        person.id !== data.founderId && !data.cofounderIds.includes(person.id),
    ) ?? [];
  const option = (person: FoundingMembers["people"][number]) => ({
    value: person.id,
    label: person.fullName,
    avatar: person.avatar ?? null,
    description: person.isPublished ? undefined : "Unpublished profile",
  });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!data) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await apiRequest("/users/founding-members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          founderId: data.founderId,
          cofounderIds: data.cofounderIds,
        }),
      });
      setSaved(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save founding members.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <WorkspaceHero
        eyebrow="People & accounts"
        title="Founding members"
        description="Choose one founder and optional co-founders. These designations stay independent of current ranks and job titles."
        action={
          <ButtonLink href="/workspace/users" variant="secondary">
            People & accounts
          </ButtonLink>
        }
      />
      <WorkspacePanel
        title="Founder and co-founders"
        description="Choose from existing people. Only published profiles appear on the public People page."
      >
        {!data && error ? (
          <StatePanel
            frame="workspace"
            title="Unable to load founding members"
            body={error}
            action={{
              label: "Retry",
              onClick: () => {
                setError("");
                setReload((value) => value + 1);
              },
            }}
          />
        ) : (
          <form
            className="grid gap-6 px-[var(--workspace-gutter)] py-6"
            onSubmit={save}
            aria-busy={!data || saving}
          >
            <FormField label="Founder">
              <div className="flex min-w-0 items-center gap-2">
                <SearchableSelect
                  ariaLabel="Founder"
                  placeholder="Select founder…"
                  searchPlaceholder="Search people…"
                  placeholderLoading={!data}
                  disabled={saving}
                  value={data?.founderId ?? ""}
                  options={(data?.people ?? []).map(option)}
                  onValueChange={(value) => {
                    setSaved(false);
                    if (value === cofounderId) setCofounderId("");
                    setData(
                      (current) =>
                        current && {
                          ...current,
                          founderId: value,
                          cofounderIds: current.cofounderIds.filter(
                            (id) => id !== value,
                          ),
                        },
                    );
                  }}
                />
                {founder ? (
                  <IconButton
                    aria-label={`Remove founder ${founder.fullName}`}
                    disabled={saving}
                    className="text-danger hover:text-danger"
                    onClick={() =>
                      setRemoving({
                        id: founder.id,
                        name: founder.fullName,
                        founder: true,
                      })
                    }
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </IconButton>
                ) : null}
              </div>
            </FormField>
            <div className="grid gap-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 max-[640px]:grid-cols-1">
                <FormField label="Co-Founder(s) (optional)">
                  <SearchableSelect
                    ariaLabel="Select co-founder"
                    placeholder="Select a person…"
                    searchPlaceholder="Search people…"
                    placeholderLoading={!data}
                    disabled={saving || !candidates.length}
                    value={cofounderId}
                    options={candidates.map(option)}
                    onValueChange={setCofounderId}
                  />
                </FormField>
                <ButtonControl
                  disabled={saving || !cofounderId}
                  onClick={() => {
                    setData(
                      (current) =>
                        current && {
                          ...current,
                          cofounderIds: [...current.cofounderIds, cofounderId],
                        },
                    );
                    setCofounderId("");
                    setSaved(false);
                  }}
                >
                  <Plus aria-hidden="true" size={15} />
                  Add co-founder
                </ButtonControl>
              </div>
              {cofounders.length ? (
                <ul className="m-0 list-none divide-y divide-line rounded-control border border-line p-0">
                  {cofounders.map((person) => (
                    <li
                      key={person.id}
                      className="flex min-w-0 items-center justify-between gap-4 px-4 py-3"
                    >
                      <PersonPortrait person={person} variant="small" />
                      <div className="min-w-0 flex-1">
                        <p className="m-0 break-words text-sm font-medium">
                          {person.fullName}
                        </p>
                        {!person.isPublished ? (
                          <p className="mt-1 mb-0 text-xs text-ink-muted">
                            Unpublished profile
                          </p>
                        ) : null}
                      </div>
                      <IconButton
                        aria-label={`Remove co-founder ${person.fullName}`}
                        disabled={saving}
                        className="text-danger hover:text-danger"
                        onClick={() =>
                          setRemoving({
                            id: person.id,
                            name: person.fullName,
                            founder: false,
                          })
                        }
                      >
                        <Trash2 aria-hidden="true" size={16} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-sm text-ink-muted">
                  No co-founders added.
                </p>
              )}
            </div>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            {saved ? (
              <p role="status" className="text-sm text-success">
                Founding members saved.
              </p>
            ) : null}
            <div className="flex justify-end">
              <ButtonControl
                type="submit"
                variant="primary"
                disabled={!data || saving}
              >
                {saving ? "Saving…" : "Save founding members"}
              </ButtonControl>
            </div>
          </form>
        )}
      </WorkspacePanel>
      <ConfirmDialog
        open={Boolean(removing)}
        title={removing?.founder ? "Remove founder?" : "Remove co-founder?"}
        description={
          removing
            ? `Remove ${removing.name} as ${removing.founder ? "founder" : "a co-founder"}? Save changes to apply.`
            : ""
        }
        confirmLabel="Remove designation"
        tone="danger"
        onCancel={() => setRemoving(undefined)}
        onConfirm={() => {
          if (!removing) return;
          setData(
            (current) =>
              current && {
                ...current,
                founderId: removing.founder ? null : current.founderId,
                cofounderIds: current.cofounderIds.filter(
                  (id) => id !== removing.id,
                ),
              },
          );
          setSaved(false);
          setRemoving(undefined);
        }}
      />
    </>
  );
}
