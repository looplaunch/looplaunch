import Link from "next/link";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5] flex items-center justify-center p-6">
      <div className="max-w-sm text-center flex flex-col items-center">
        <LoopyMascot size={72} />
        <p className="mt-5 text-xs font-mono uppercase tracking-wider text-[#8B5CF6]">404</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Loopy couldn&apos;t find that page</h1>
        <p className="mt-2 text-sm text-[#A1A1AA]">It may have moved, or the link might be wrong.</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center px-4 py-2 rounded-lg bg-[#F4F4F5] text-[#09090B] text-sm font-medium hover:bg-white transition-colors"
        >
          Back to Loop Launch
        </Link>
      </div>
    </div>
  );
}
