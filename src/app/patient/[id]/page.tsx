"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getCase,
  getSession,
  imageUrl,
  type AuthUser,
  type CaseRecord,
} from "@/lib/api";

export default function PatientReportPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session || session.user.role !== "PATIENT") {
      router.replace("/login");
      return;
    }
    setUser(session.user);
    getCase(session.token, params.id)
      .then((c) => {
        if (c.status !== "RELEASED") {
          setError("This report is not yet released.");
          return;
        }
        setCaseRecord(c);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load report"),
      );
  }, [params.id, router]);

  if (!user) return null;

  return (
    <main className="flex flex-1 flex-col bg-app px-4 py-10 text-navy">
      <div className="mx-auto w-full max-w-3xl">
        <button
          onClick={() => router.push("/patient")}
          className="text-sm text-slate hover:text-navy"
        >
          ← Back to my reports
        </button>

        {error && <p className="mt-6 text-sm text-danger">{error}</p>}

        {caseRecord && (
          <div className="mt-6 grid gap-8 md:grid-cols-[320px_1fr]">
            {caseRecord.images?.[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl(caseRecord.images[0].storedName)}
                alt="Tissue patch"
                className="h-80 w-80 rounded-md border border-line object-cover shadow-sm"
              />
            )}

            <div>
              <h1 className="text-xl font-bold capitalize">
                {caseRecord.organ} report
              </h1>
              <p className="mt-1 text-sm text-slate">
                Released{" "}
                {caseRecord.diagnosis?.releasedAt &&
                  new Date(
                    caseRecord.diagnosis.releasedAt,
                  ).toLocaleDateString()}
              </p>

              {caseRecord.diagnosis && (
                <div className="mt-6 rounded-md border border-success/30 bg-success/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-success">
                    Clinician diagnosis
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-navy">
                    {caseRecord.diagnosis.summary}
                  </p>
                </div>
              )}

              <p className="mt-6 text-xs text-slate">
                This report was reviewed by a pathologist and signed off by a
                clinician before release. It is part of a research prototype and
                is not a substitute for professional medical advice.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
