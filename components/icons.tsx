import type { ReactNode, SVGProps } from "react";

/** One icon family: 24px grid, 1.75 stroke, round caps. Decorative by default (aria-hidden); pair with a visible or sr-only label. */
function Svg({ children, size = 24, ...p }: SVGProps<SVGSVGElement> & { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...p}>
      {children}
    </svg>
  );
}
type P = SVGProps<SVGSVGElement> & { size?: number };

export const IconSend = (p: P) => <Svg {...p}><path d="M21 3 10.5 13.5" /><path d="M21 3l-6.5 18-4-7.5L3 9.5 21 3z" /></Svg>;
export const IconInbox = (p: P) => <Svg {...p}><path d="M3 13l2.6-7.2A2 2 0 0 1 7.5 4.5h9a2 2 0 0 1 1.9 1.3L21 13" /><path d="M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5h-5.5a2.5 2.5 0 0 1-5 0H3z" /></Svg>;
export const IconUsers = (p: P) => <Svg {...p}><circle cx="9" cy="8" r="3.2" /><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" /><path d="M18 14.3A6.2 6.2 0 0 1 21.2 20" /></Svg>;
export const IconBuilding = (p: P) => <Svg {...p}><path d="M3 21h18" /><path d="M5 21V10l7-5 7 5v11" /><path d="M9 21v-6h6v6" /><path d="M12 10.2v.01" /></Svg>;
export const IconSliders = (p: P) => <Svg {...p}><path d="M4 7h9" /><path d="M17 7h3" /><circle cx="15" cy="7" r="2" /><path d="M4 17h3" /><path d="M11 17h9" /><circle cx="9" cy="17" r="2" /></Svg>;
export const IconCheck = (p: P) => <Svg {...p}><path d="M5 12.5 10 17.5 19 7" /></Svg>;
export const IconX = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const IconClock = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>;
export const IconPause = (p: P) => <Svg {...p}><path d="M9 6v12M15 6v12" /></Svg>;
export const IconShield = (p: P) => <Svg {...p}><path d="M12 3 5 6v5.5c0 4.2 2.8 7.6 7 9.5 4.2-1.9 7-5.3 7-9.5V6l-7-3z" /><path d="M9 12l2.2 2.2L15.2 10" /></Svg>;
export const IconPhone = (p: P) => <Svg {...p}><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></Svg>;
export const IconLock = (p: P) => <Svg {...p}><rect x="5" y="10.5" width="14" height="10" rx="2.2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></Svg>;
export const IconAlert = (p: P) => <Svg {...p}><path d="M12 4 2.8 19.5h18.4L12 4z" /><path d="M12 10v4.2M12 17.2v.01" /></Svg>;
export const IconArrowRight = (p: P) => <Svg {...p}><path d="M4 12h15" /><path d="M13 6l6 6-6 6" /></Svg>;
export const IconArrowLeft = (p: P) => <Svg {...p}><path d="M20 12H5" /><path d="M11 6l-6 6 6 6" /></Svg>;
export const IconMic = (p: P) => <Svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" /><path d="M12 18v3" /></Svg>;
export const IconUpload = (p: P) => <Svg {...p}><path d="M12 15V4" /><path d="M7.5 8.5 12 4l4.5 4.5" /><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" /></Svg>;
export const IconRedirect = (p: P) => <Svg {...p}><path d="M4 18c0-5 3-8 8-8h7" /><path d="M15 6l4 4-4 4" /></Svg>;
export const IconLink = (p: P) => <Svg {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" /></Svg>;
export const IconBell = (p: P) => <Svg {...p}><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2H4.5L6 17z" /><path d="M10 21h4" /></Svg>;
