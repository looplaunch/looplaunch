import { AppNav } from "@/components/app/AppNav";
import { PageTransition } from "@/components/app/PageTransition";

/** Shown while a signed-in page loads on the server: the bar and the page's outline, so the click answers at once. */
export function AppSkeleton({
  rows = 3,
  aside = false,
  active,
}: {
  rows?: number;
  aside?: boolean;
  /** The page loading, so the bar (the same one the page shows) marks it and stays put when it arrives */
  active?: "home" | "history" | "profile";
}) {
  return (
    <PageTransition>
    <div className="min-h-screen bg-[#09090B]" aria-busy="true" aria-label="Loading">
      <AppNav profile={undefined} active={active} />
      <div className="mx-auto max-w-[1148px] px-4 sm:px-6 pt-10 sm:pt-14 animate-pulse">
        <div className="h-8 w-56 rounded-lg bg-[#17171B]" />
        <div className="mt-3 h-4 w-80 max-w-full rounded bg-[#131317]" />
        <div className={`mt-8 grid gap-4 ${aside ? "lg:grid-cols-[1fr_340px]" : ""}`}>
          <div className="flex flex-col gap-3">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="h-20 rounded-[20px] bg-[#111114]" />
            ))}
          </div>
          {aside && <div className="hidden lg:block h-64 rounded-[20px] bg-[#111114]" />}
        </div>
      </div>
    </div>
    </PageTransition>
  );
}
