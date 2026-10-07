"use client";

import { useRouter } from "next/navigation";
import { clearSession } from "@/lib/api";

export function AppHeader({
  roleLabel,
  userName,
}: {
  roleLabel: string;
  userName: string;
}) {
  const router = useRouter();

  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-white">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
              <path
                d="M12 3v6m0 6v6M5 12h4m6 0h4"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="text-sm font-semibold text-navy">UniCanPredict</span>
          <span className="hidden text-sm text-slate sm:inline">/ {roleLabel}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden truncate text-sm text-slate sm:inline">
            {userName}
          </span>
          <button
            onClick={() => {
              clearSession();
              router.push("/login");
            }}
            className="text-sm font-medium text-brand hover:text-brand-hover"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
