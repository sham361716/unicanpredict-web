"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  clearSession,
  getSession,
  listAudit,
  listCases,
  type AuditEntry,
  type AuthUser,
  type CaseRecord,
} from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-line/60 text-slate",
  AWAITING_REVIEW: "bg-warning/10 text-warning",
  REJECTED_QC: "bg-danger/10 text-danger",
  UNDER_REVIEW: "bg-ai/10 text-ai",
  VERIFIED: "bg-accent-soft text-brand",
  DIAGNOSED: "bg-brand/10 text-brand",
  RELEASED: "bg-success/10 text-success",
};

const ALL_STATUSES = Object.keys(STATUS_STYLES);

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

  return (
    <main className="flex flex-1 flex-col bg-app px-4 py-10 text-navy">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin — Dashboard</h1>
            <p className="mt-1 text-sm text-slate">
              Signed in as {user.name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/disagreements"
              className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-brand hover:bg-accent-soft/50"
            >
              Disagreement cases
            </Link>
            <button
              onClick={() => {
                clearSession();
                router.push("/login");
              }}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-slate hover:bg-line/60"
            >
              Sign out
            </button>
          </div>
        </div>

        {loading && <p className="mt-8 text-sm text-slate">Loading...</p>}

        {!loading && (
          <>
            {/* ── Status counts ─────────────────────────────── */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {ALL_STATUSES.map((s) => (
                <div
                  key={s}
                  className="rounded-md border border-line bg-white p-4 shadow-sm"
                >
                  <p
                    className={cn(
                      "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                      STATUS_STYLES[s],
                    )}
                  >
                    {s.replace("_", " ")}
                  </p>
                  <p className="mt-2 text-2xl font-bold">{counts[s]}</p>
                </div>
              ))}
            </div>

            {/* ── All cases ─────────────────────────────────── */}
            <div className="mt-10">
              <h2 className="text-sm font-semibold text-navy">
                All cases ({cases.length})
              </h2>
              <div className="mt-4 overflow-x-auto rounded-md border border-line bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-app text-slate">
                    <tr>
                      <th className="px-4 py-2 font-medium">Patient</th>
                      <th className="px-4 py-2 font-medium">Organ</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((c) => (
                      <tr key={c.id} className="border-t border-line">
                        <td className="px-4 py-2">{c.patient?.pseudonymRef}</td>
                        <td className="px-4 py-2 capitalize">{c.organ}</td>
                        <td className="px-4 py-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              STATUS_STYLES[c.status],
                            )}
                          >
                            {c.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate">
                          {new Date(c.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Audit log ─────────────────────────────────── */}
            <div className="mt-10 mb-10">
              <h2 className="text-sm font-semibold text-navy">
                Audit log (append-only)
              </h2>
              <div className="mt-4 max-h-96 space-y-1 overflow-y-auto rounded-md border border-line bg-white p-4 shadow-sm">
                {audit.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 py-1 text-xs"
                  >
                    <span className="w-40 shrink-0 text-slate">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                    <span className="w-44 shrink-0 font-mono text-brand">
                      {entry.action}
                    </span>
                    <span className="w-40 shrink-0 text-slate">
                      {entry.user
                        ? `${entry.user.name} (${entry.user.role})`
                        : "—"}
                    </span>
                    <span className="text-slate">{entry.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
