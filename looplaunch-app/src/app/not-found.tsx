import Link from "next/link";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import { PRIMARY_INLINE } from "@/components/ui/fields";

export default function NotFound() {
  return (
    <div className="min-h-svh bg-[#09090B] text-[#F4F4F5] flex items-center justify-center p-6">
      <div className="max-w-sm text-center flex flex-col items-center">
        <LoopyMascot size={72} />
        <h1 className="mt-5 text-[22px] leading-tight font-semibold tracking-[-0.01em]">Loopy couldn&apos;t find that page</h1>
        <p className="mt-2 text-[15px] leading-[1.5] text-[#B4B4BC]">It may have moved, or the link might be wrong.</p>
        <Link href="/" className={`${PRIMARY_INLINE} mt-6`}>
          Back to Loop Launch
        </Link>
      </div>
    </div>
  );
}
