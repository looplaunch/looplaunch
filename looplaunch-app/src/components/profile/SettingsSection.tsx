import type { ReactNode } from "react";

interface SettingsSectionProps {
  id: string;
  title: string;
  description?: ReactNode;
  /** The account-deleting section: its title in the negative colour */
  danger?: boolean;
  children: ReactNode;
}

/** One settings area: its title and what it does on the left, its panel on the right; a rule above each. */
export function SettingsSection({ id, title, description, danger = false, children }: SettingsSectionProps) {
  return (
    <section
      aria-labelledby={id}
      className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-10 gap-y-4 py-8 border-t border-[#1C1C21]"
    >
      <div className="lg:pt-1">
        <h2 id={id} className={`text-[16px] font-medium ${danger ? "text-[#F87171]" : "text-[#F4F4F5]"}`}>
          {title}
        </h2>
        {description && <p className="mt-1 text-[14px] leading-6 text-[#B4B4BC] max-w-[42ch]">{description}</p>}
      </div>
      <div className="min-w-0 rounded-[16px] bg-[#111114] p-5 sm:p-6">{children}</div>
    </section>
  );
}
