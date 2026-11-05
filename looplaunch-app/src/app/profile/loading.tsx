import { AppSkeleton } from "@/components/app/AppSkeleton";

export default function Loading() {
  return <AppSkeleton active="profile" rows={3} aside />;
}
