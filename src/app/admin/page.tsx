"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/app-header";
import {
  getSession,
  listAudit,
  listCases,
  type AuditEntry,
  type AuthUser,
  type CaseRecord,
} from "@/lib/api";

// One token per status, reused for the distribution bar, the legend, and
// the cases table, so the same color always means the same status.
const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-line text-slate",
  AWAITING_REVIEW: "bg-warning text-warning",
  REJECTED_QC: "bg-danger text-danger",
  UNDER_REVIEW: "bg-ai text-ai",
  VERIFIED: "bg-brand text-brand",
  DIAGNOSED: "bg-brand text-brand",
  RELEASED: "bg-success text-success",
};

const ALL_STATUSES = Object.keys(STATUS_COLOR);

function label(status: string): string {
  return status.replaceAll("_", " ").toLowerCase();
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/login");
      return;
    }
    setUser(session.user);
    Promise.all([listCases(session.token), listAudit(session.token)])
      .then(([c, a]) => {
        setCases(c);
        setAudit(a);
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (!user) return null;

  const counts = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, cases.filter((c) => c.status === s).length]),
  );
  const activeStatuses = ALL_STATUSES.filter((s) => counts[s] > 0);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-app text-navy">
      <AppHeader roleLabel="Admin" userName={user.name} />

      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-slate">
              {loading ? "Loading" : `${cases.length} cases across the pipeline`}
            </p>
          </div>
          <Link
            href="/admin/disagreements"
            className="h-10 rounded-md border border-line px-4 text-sm font-medium leading-10 text-brand hover:bg-accent-soft/50"
          >
            Disagreement cases
          </Link>
        </div>

        {loading && <p className="mt-10 text-sm text-slate">Loading…</p>}

        {!loading && (
          <>
            {/* ── Pipeline distribution ──────────────────────── */}
            <div className="mt-8">
              {cases.length > 0 ? (
                <>
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-line">
                    {activeStatuses.map((s) => (
                      <div
                        key={s}
                        className={cn(STATUS_COLOR[s].split(" ")[0], "h-full")}
                        style={{ width: `${(counts[s] / cases.length) * 100}%` }}
                        title={`${label(s)}: ${counts[s]}`}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                    {ALL_STATUSES.map((s) => (
                      <div key={s} className="flex items-center gap-2 text-sm">
                        <span
                          className={cn("h-2 w-2 rounded-full", STATUS_COLOR[s].split(" ")[0])}
                        />
                        <span className="capitalize text-slate">{label(s)}</span>
                        <span className="font-mono tabular-nums text-navy">{counts[s]}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="rounded-md border border-dashed border-line bg-card p-6 text-center text-sm text-slate">
                  No cases in the system yet.
                </p>
              )}
            </div>

            {/* ── All cases ─────────────────────────────────── */}
            <div className="mt-12">
              <h2 className="text-sm font-medium text-slate">All cases</h2>
              <div className="mt-3 overflow-x-auto rounded-md border border-line bg-card">
                <table className="w-full min-w-140 border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-slate">
                      <th className="px-4 py-3 font-medium">Patient ref</th>
                      <th className="px-4 py-3 font-medium">Organ</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                      <th className="px-4 py-3 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-slate">
                          No cases yet.
                        </td>
                      </tr>
                    )}
                    {cases.map((c) => (
                      <tr key={c.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 font-mono tabular-nums">
                          {c.patient?.pseudonymRef}
                        </td>
                        <td className="px-4 py-3 capitalize">{c.organ}</td>
                        <td className="px-4 py-3 tabular-nums text-slate">
                          {new Date(c.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={cn(
                              "font-medium capitalize",
                              STATUS_COLOR[c.status]?.split(" ")[1] ?? "text-slate",
                            )}
                          >
                            {label(c.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Audit log ─────────────────────────────────── */}
            <div className="mt-12 mb-10">
              <h2 className="text-sm font-medium text-slate">Audit log</h2>
              <div className="mt-3 max-h-96 overflow-y-auto rounded-md border border-line bg-card">
                {audit.length === 0 && (
                  <p className="px-4 py-10 text-center text-sm text-slate">No entries yet.</p>
                )}
                {audit.map((entry, i) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2.5 text-xs",
                      i !== 0 && "border-t border-line",
                    )}
                  >
                    <span className="w-40 shrink-0 tabular-nums text-slate">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                    <span className="w-44 shrink-0 font-mono text-brand">{entry.action}</span>
                    <span className="w-44 shrink-0 text-slate">
                      {entry.user ? `${entry.user.name} (${entry.user.role})` : "System"}
                    </span>
                    <span className="text-slate">{entry.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
