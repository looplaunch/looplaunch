"use client";

import { useState } from "react";
import type { ProfileInfo } from "@/lib/auth/profile";

interface AvatarProps {
  profile: Pick<ProfileInfo, "avatarUrl" | "initials" | "avatarColor">;
  size?: number;
}

/** Profile photo, or initials on the person's chosen color when there's no photo (or it fails to load). */
export function Avatar({ profile, size = 32 }: AvatarProps) {
  const [broken, setBroken] = useState(false);

  if (profile.avatarUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatarUrl}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="rounded-full shrink-0 flex items-center justify-center font-semibold text-white select-none"
      style={{ width: size, height: size, background: profile.avatarColor, fontSize: Math.round(size * 0.4) }}
    >
      {profile.initials}
    </span>
  );
}
