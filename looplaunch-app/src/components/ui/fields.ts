/** App form styles: 40px fields with labels above, one white primary, a dark secondary, an outlined danger. */

/** Add the right padding per field: pr-3.5, or pr-10 when a button sits inside it. */
export const FIELD =
  "w-full h-10 rounded-[10px] bg-[#1C1C21] border border-[#2E2E35] hover:border-[#3F3F48] focus:border-[#8B5CF6] focus:shadow-[0_0_0_4px_rgba(139,92,246,0.16)] pl-3.5 text-[15px] text-[#F4F4F5] placeholder:text-[#8B8B94] outline-none transition-[border-color,box-shadow] duration-200 disabled:opacity-60";

export const LABEL = "block text-[14px] font-medium text-[#D4D4D8] mb-2";

const PRESS = "active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 transition cursor-pointer";

const PRIMARY_LOOK = `h-10 rounded-full bg-[#F4F4F5] text-[#09090B] text-[14px] font-semibold hover:bg-white ${PRESS}`;
const SECONDARY_LOOK = `h-10 rounded-full bg-[#1C1C21] border border-[#2E2E35] hover:border-[#3F3F48] hover:bg-[#222228] text-[14px] font-medium text-[#F4F4F5] ${PRESS}`;

/** Full-width, for narrow forms such as login */
export const PRIMARY = `w-full ${PRIMARY_LOOK}`;
export const SECONDARY = `w-full inline-flex items-center justify-center gap-2.5 ${SECONDARY_LOOK}`;

/** Sized to their label, for settings rows and dialogs */
export const PRIMARY_INLINE = `inline-flex items-center justify-center gap-2 px-5 ${PRIMARY_LOOK}`;
export const SECONDARY_INLINE = `inline-flex items-center justify-center gap-2 px-4 ${SECONDARY_LOOK}`;
export const DANGER_INLINE = `inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full border border-[#7F1D1D] text-[14px] font-medium text-[#F87171] hover:bg-[#7F1D1D]/25 ${PRESS}`;

export const TEXT_LINK = "text-[13px] text-[#B4B4BC] hover:text-white transition-colors cursor-pointer disabled:opacity-60";
