"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/app-header";
import {
  getSession,
  imageUrl,
  listCases,
  type AuthUser,
  type CaseRecord,
} from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  VERIFIED: "text-brand",
  DIAGNOSED: "text-brand",
};

export default function ClinicianPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (!session || session.user.role !== "CLINICIAN") {
      router.replace("/login");
      return;
    }
    setUser(session.user);
    listCases(session.token)
      .then(setCases)
      .finally(() => setLoading(false));
  }, [router]);

  if (!user) return null;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-app text-navy">
      <AppHeader roleLabel="Clinician" userName={user.name} />

      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Diagnosis and release</h1>
            <p className="mt-1 text-sm text-slate">
              {loading ? "Loading cases" : `${cases.length} cases ready or diagnosed`}
            </p>
          </div>
        </div>

        <div className="mt-8 overflow-x-auto rounded-md border border-line bg-card">
          <table className="w-full min-w-140 border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-slate">
                <th className="px-4 py-3 font-medium">Patch</th>
                <th className="px-4 py-3 font-medium">Patient ref</th>
                <th className="px-4 py-3 font-medium">Organ</th>
                <th className="px-4 py-3 font-medium">Verified</th>
                <th className="px-4 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate">
                    Loading cases…
                  </td>
                </tr>
              )}
              {!loading && cases.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <p className="font-medium text-navy">Nothing ready yet</p>
                    <p className="mt-1 text-slate">
                      Cases appear here once a pathologist verifies them.
                    </p>
                  </td>
                </tr>
              )}
              {cases.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/clinician/${c.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(`/clinician/${c.id}`);
                  }}
                  tabIndex={0}
                  className="cursor-pointer border-b border-line last:border-0 transition-colors hover:bg-accent-soft/50 focus-visible:bg-accent-soft/50"
                >
                  <td className="px-4 py-3">
                    {c.images?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl(c.images[0].storedName)}
                        alt=""
                        className="h-10 w-10 rounded object-cover ring-1 ring-line"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {c.patient?.pseudonymRef}
                  </td>
                  <td className="px-4 py-3 capitalize">{c.organ}</td>
                  <td className="px-4 py-3 tabular-nums text-slate">
                    {new Date(c.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        "font-medium capitalize",
                        STATUS_COLOR[c.status] ?? "text-slate",
                      )}
                    >
                      {c.status.replaceAll("_", " ").toLowerCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
