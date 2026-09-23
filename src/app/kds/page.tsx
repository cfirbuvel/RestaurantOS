"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UtensilsCrossed, Store, ArrowLeft } from "lucide-react";

interface Branch {
  id: string;
  name: string;
  slug: string;
  address?: { city?: string; street?: string };
}

export default function KDSLandingPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function init() {
      try {
        const meRes = await fetch("/api/v1/auth/me");
        if (meRes.ok) {
          const meData = await meRes.json();
          const userBranchId = meData.session?.branchId;
          if (userBranchId) {
            router.replace(`/kds/${userBranchId}`);
            return;
          }
        }

        // Fetch available branches
        const bRes = await fetch("/api/v1/branches");
        if (bRes.ok) {
          const bData = await bRes.json();
          if (Array.isArray(bData.branches) && bData.branches.length > 0) {
            if (bData.branches.length === 1) {
              router.replace(`/kds/${bData.branches[0].id}`);
              return;
            }
            setBranches(bData.branches);
          }
        }
      } catch {
        // Fallback default branch if network error or unauthenticated
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <span className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-bold">טוען נתוני עמדות KDS...</span>
      </div>
    );
  }

  const defaultBranchId = "be7c3e30-b28b-4d23-9d78-b56b545351f5";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-100">מערכת KDS — בחר סניף</h1>
            <p className="text-xs text-slate-400">בחר את הסניף עבור מסך המטבח הדיגיטלי</p>
          </div>
        </div>

        {branches.length > 0 ? (
          <div className="space-y-3">
            {branches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => router.push(`/kds/${b.id}`)}
                className="w-full p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 border border-slate-700/60 transition-all flex items-center justify-between text-right group"
              >
                <div className="flex items-center gap-3">
                  <Store className="w-5 h-5 text-blue-400" />
                  <div>
                    <div className="font-bold text-slate-100 text-sm">{b.name}</div>
                    {b.address?.city && (
                      <div className="text-xs text-slate-400">{b.address.city}</div>
                    )}
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:-translate-x-1 transition-transform" />
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => router.push(`/kds/${defaultBranchId}`)}
              className="w-full p-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-sm shadow-lg transition-all flex items-center justify-between"
            >
              <span>כניסה לסניף ברירת מחדל</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
