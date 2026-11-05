import { AppSkeleton } from "@/components/app/AppSkeleton";

export default function Loading() {
  return <AppSkeleton active="history" rows={4} />;
}
