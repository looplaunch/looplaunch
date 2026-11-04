import Image from "next/image";

/** Shown while a signed-in page loads on the server: the bar and the page's outline, so the click answers at once. */
export function AppSkeleton({ rows = 3, aside = false }: { rows?: number; aside?: boolean }) {
  return (
    <div className="min-h-screen bg-[#09090B]" aria-busy="true" aria-label="Loading">
      <div className="sticky top-0 z-40 h-14 bg-[#09090B] border-b border-[#1C1C21]">
        <div className="mx-auto max-w-[1148px] h-full px-4 sm:px-6 flex items-center justify-between">
          <Image src="/logo.png" alt="Loop Launch" width={110} height={36} className="h-7 w-auto" priority />
          <span className="h-8 w-8 rounded-full bg-[#17171B]" />
        </div>
      </div>
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
  );
}
