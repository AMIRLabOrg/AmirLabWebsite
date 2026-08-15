"use client";

import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import { useEffect, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/client-api";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PaginationControls } from "@/components/pagination-controls";
import { StatePanel } from "@/components/state-panel";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonControl, ButtonLink } from "@/components/ui/button-control";
import { SelectControl } from "@/components/ui/select-control";
import { InputControl } from "@/components/ui/form-controls";
import { FormField, FormMessage } from "@/components/ui/form-field";
import type { PaginatedResponse } from "@/lib/types";
import { useNotifications } from "@/components/notification-provider";

const ROLES = ["MEMBER", "MODERATOR", "ADMIN"] as const;
const RANKS = [
  "RESEARCH_INTERN",
  "RESEARCH_ASSISTANT",
  "RESEARCHER",
  "SENIOR_RESEARCHER",
  "LEAD_RESEARCHER",
  "DEPARTMENT_HEAD",
  "ADVISOR",
] as const;

interface Account {
  id: string;
  email: string | null;
  role: string;
  status: string;
  setupEmailQueuedAt: string | null;
  person: { fullName: string; rank: string | null; slug: string } | null;
}

function readable(value: string): string {
  return value.replaceAll("_", " ").toLowerCase();
}

function accountStatusLabel(status: string): string {
  return status === "PENDING_SETUP" ? "setup pending" : readable(status);
}

function accountStatusTone(status: string): BadgeTone {
  if (status === "ACTIVE") return "field";
  if (status === "PENDING_SETUP") return "gold";
  if (status === "SUSPENDED" || status === "ARCHIVED") return "rust";
  return "neutral";
}

export function UserManagement() {
  const { showToast } = useNotifications();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string>();
  const [activeId, setActiveId] = useState<string>();
  const [pendingAccess, setPendingAccess] = useState<Account>();
  const [deletePending, setDeletePending] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<PaginatedResponse<Account>>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [rank, setRank] = useState("ALL");
  const [sort, setSort] = useState("NEWEST");
  const [reload, setReload] = useState(0);

  function beginRefresh() {
    setLoading(true);
  }

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        sort,
      });
      if (search.trim()) params.set("search", search.trim());
      if (role !== "ALL") params.set("role", role);
      if (status !== "ALL") params.set("status", status);
      if (rank !== "ALL") params.set("rank", rank);

      setLoading(true);
      setError(undefined);
      void apiRequest<PaginatedResponse<Account>>(`/users?${params}`, {
        method: "GET",
      })
        .then((response) => {
          if (!active) return;
          setResult(response);
          setAccounts(response.items);
        })
        .catch((caught: unknown) => {
          if (active) {
            setError(
              caught instanceof Error
                ? caught.message
                : "Unable to load accounts.",
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [page, rank, reload, role, search, sort, status]);

  async function sendAccess(account: Account) {
    setError(undefined);
    setActiveId(account.id);
    try {
      const result = await apiRequest<{ queuedAt: string }>(
        `/users/${account.id}/send-access-email`,
        { method: "POST" },
      );
      setAccounts((current) =>
        current.map((item) =>
          item.id === account.id
            ? { ...item, setupEmailQueuedAt: result.queuedAt }
            : item,
        ),
      );
      showToast({
        body: `A one-time setup link was queued for ${account.email}.`,
        title: "Access email queued",
      });
      setPendingAccess(undefined);
    } catch (caught) {
      const message = caught instanceof Error
        ? caught.message
        : "Unable to send access email.";
      setError(message);
      showToast({ body: message, title: "Access email was not sent", tone: "error" });
    } finally {
      setActiveId(undefined);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-4 max-[640px]:flex-col max-[640px]:items-stretch" data-loading={loading || undefined}>
        <p className={loadingPlaceholder(loading, "label", "medium")} data-placeholder={loading ? "label" : undefined} data-placeholder-width="medium">
          {result ? `${result.total} account${result.total === 1 ? "" : "s"}` : "Member accounts"}
        </p>
        <ButtonLink href="/workspace/users/new" variant="primary">
          <Plus aria-hidden="true" size={16} /> New account
        </ButtonLink>
      </div>

      {error && result ? <FormMessage>{error}</FormMessage> : null}

      <div className="grid min-w-0 grid-cols-[minmax(210px,1.5fr)_repeat(4,minmax(120px,.65fr))] items-end gap-[.8rem] rounded-panel border border-line bg-surface p-4 max-[980px]:grid-cols-2 max-[640px]:grid-cols-1">
        <FormField className="min-w-0" htmlFor="account-search" label="Search accounts">
          <div className="relative grid items-center">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 z-[1] text-ink-muted" size={17} />
            <InputControl
              className="pl-10" id="account-search"
              onChange={(event) => {
                beginRefresh();
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Name or email"
              value={search}
            />
          </div>
        </FormField>
        <FormField htmlFor="account-role" label="Role">
          <SelectControl
            id="account-role"
            onValueChange={(value) => {
              beginRefresh();
              setRole(value);
              setPage(1);
            }}
            options={[
              { label: "All roles", value: "ALL" },
              ...ROLES.map((item) => ({
                label: readable(item),
                value: item,
              })),
            ]}
            value={role}
          />
        </FormField>
        <FormField htmlFor="account-status" label="Status">
          <SelectControl
            id="account-status"
            onValueChange={(value) => {
              beginRefresh();
              setStatus(value);
              setPage(1);
            }}
            options={[
              { label: "All statuses", value: "ALL" },
              { label: "Setup pending", value: "PENDING_SETUP" },
              { label: "Active", value: "ACTIVE" },
              { label: "Suspended", value: "SUSPENDED" },
              { label: "Archived", value: "ARCHIVED" },
            ]}
            value={status}
          />
        </FormField>
        <FormField htmlFor="account-rank" label="Rank">
          <SelectControl
            id="account-rank"
            onValueChange={(value) => {
              beginRefresh();
              setRank(value);
              setPage(1);
            }}
            options={[
              { label: "All ranks", value: "ALL" },
              ...RANKS.map((item) => ({
                label: readable(item),
                value: item,
              })),
            ]}
            value={rank}
          />
        </FormField>
        <FormField htmlFor="account-sort" label="Sort">
          <SelectControl
            id="account-sort"
            onValueChange={(value) => {
              beginRefresh();
              setSort(value);
              setPage(1);
            }}
            options={[
              { label: "Newest first", value: "NEWEST" },
              { label: "Oldest first", value: "OLDEST" },
              { label: "Name A–Z", value: "NAME" },
            ]}
            value={sort}
          />
        </FormField>
      </div>

      {error && !result ? (
        <StatePanel
          action={{
            label: "Retry",
            onClick: () => {
              beginRefresh();
              setReload((value) => value + 1);
            },
          }}
          body="The connection dropped. Nothing was lost; reconnect to continue."
          title="Could not load accounts"
          variant="error"
        />
      ) : !loading && !accounts.length ? (
        <StatePanel
          body="Create the first member account from the page action above."
          title="No accounts yet"
        />
      ) : (
        <section className="grid gap-4" data-loading={loading || undefined}>
          {(loading && !accounts.length ? Array.from({ length: 4 }, () => undefined) : accounts).map((account, index) => (
              <article className="grid min-w-0 grid-cols-[minmax(220px,4fr)_minmax(260px,5fr)_minmax(360px,3fr)] items-center gap-4 rounded-panel border border-line bg-surface p-4 max-[1180px]:grid-cols-2 max-[700px]:grid-cols-1" key={account?.id ?? `account-loading-${index}`}>
                <div className="grid min-w-0 gap-[.35rem] [overflow-wrap:anywhere]">
                  <strong className={cn("text-[.95rem] font-semibold leading-[1.35]", loadingPlaceholder(loading, "text", "long"))} data-placeholder="text" data-placeholder-width="long">
                    {account?.person?.fullName ?? (loading ? "Loading account" : "Account without profile")}
                  </strong>
                  <div className="flex flex-wrap items-center gap-[.35rem]">
                    <Badge loading={loading}>{account ? readable(account.role) : "member"}</Badge>
                    <Badge dot loading={loading} tone={account ? accountStatusTone(account.status) : "neutral"}>
                      {account ? accountStatusLabel(account.status) : "loading"}
                    </Badge>
                    {loading || account?.person?.rank ? (
                      <Badge loading={loading} tone="field">{account?.person?.rank ? readable(account.person.rank) : "rank"}</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="grid min-w-0 gap-[.35rem]">
                  <span className="text-[.68rem] text-ink-muted">Account email</span>
                  <strong className={cn("text-[.82rem] font-semibold [overflow-wrap:anywhere]", loadingPlaceholder(loading, "text", "long"))} data-placeholder="text" data-placeholder-width="long">{account?.email ?? (loading ? "loading@example.org" : "Email not set")}</strong>
                </div>
                <div className="flex items-center justify-end gap-2 max-[1180px]:col-span-full max-[1180px]:justify-start max-[700px]:grid max-[700px]:grid-cols-1">
                  <ButtonLink href={account ? `/workspace/users/${account.id}/edit` : "#"} loading={loading || !account} variant="secondary">
                    <Pencil aria-hidden="true" size={15} /> Edit
                  </ButtonLink>
                  <ButtonControl disabled={!account} loading={loading} onClick={() => account && setDeletePending(account.id)} variant="danger">
                    <Trash2 size={15} /> Delete
                  </ButtonControl>
                  {loading || account?.status === "PENDING_SETUP" ? (
                    <ButtonControl
                      disabled={!account || activeId === account?.id || !account?.email}
                      loading={loading}
                      onClick={() => account && setPendingAccess(account)}
                      variant="primary"
                    >
                      {account?.setupEmailQueuedAt ? "Resend access email" : "Send access email"}
                    </ButtonControl>
                  ) : null}
                </div>
                {!loading && account?.status === "PENDING_SETUP" && account.setupEmailQueuedAt ? (
                  <p className="m-0 text-[.82rem] leading-[1.5] text-ink-muted">
                    Last queued {new Date(account.setupEmailQueuedAt).toLocaleString()}
                  </p>
                ) : null}
              </article>
            ))}
        </section>
      )}
      {(loading || result) ? (
        <PaginationControls
          loading={loading}
          onPageChange={(nextPage) => {
            beginRefresh();
            setPage(nextPage);
          }}
          page={result?.page ?? page}
          pageSize={result?.pageSize ?? 20}
          total={result?.total ?? 0}
          totalPages={result?.totalPages ?? 1}
        />
      ) : null}
      <ConfirmDialog
        busy={activeId === pendingAccess?.id}
        confirmLabel={
          pendingAccess?.setupEmailQueuedAt
            ? "Resend access email"
            : "Send access email"
        }
        description={`A one-time account setup link will be queued for ${pendingAccess?.email ?? "this member"}. The link expires after 24 hours.`}
        onCancel={() => setPendingAccess(undefined)}
        onConfirm={() => {
          if (pendingAccess) void sendAccess(pendingAccess);
        }}
        open={Boolean(pendingAccess)}
        title={
          pendingAccess?.setupEmailQueuedAt
            ? "Send a new setup link?"
            : "Give this member account access?"
        }
      />
      <ConfirmDialog
        confirmLabel="Delete account"
        description="This account will be permanently removed."
        onCancel={() => setDeletePending(undefined)}
        onConfirm={() => {
          showToast({ body: "Account deletion is not yet implemented.", title: "Not implemented", tone: "error" });
          setDeletePending(undefined);
        }}
        open={Boolean(deletePending)}
        title="Delete this account?"
        tone="danger"
      />
    </div>
  );
}
