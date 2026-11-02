/** Demo identities shared by the memory store and the Supabase seed script. */
export const DEMO = {
  circleName: "The Okafors",
  inviteCode: "OKAFOR",
  users: [
    { key: "ada", name: "Ada", label: "Mum", role: "owner" as const, envEmail: "DEMO_ADA_PAYPAL_EMAIL", fallback: "ada.buyer@personal.example.com", login: "ada@kinproof.demo" },
    { key: "chidi", name: "Chidi", label: "Son", role: "member" as const, envEmail: "DEMO_CHIDI_PAYPAL_EMAIL", fallback: "chidi@personal.example.com", login: "chidi@kinproof.demo" },
    { key: "ngozi", name: "Ngozi", label: "Daughter", role: "member" as const, envEmail: "DEMO_NGOZI_PAYPAL_EMAIL", fallback: "ngozi@personal.example.com", login: "ngozi@kinproof.demo" },
  ],
  institutions: [
    { name: "St. Luke's Hospital", kind: "hospital" as const, city: "Lagos", aliases: ["st lukes", "saint lukes", "st. luke's"], envEmail: "DEMO_HOSPITAL_PAYPAL_EMAIL", fallback: "hospital@business.example.com" },
    { name: "Kings College", kind: "school" as const, city: "Lagos", aliases: ["kings college lagos"], envEmail: "DEMO_SCHOOL_PAYPAL_EMAIL", fallback: "school@business.example.com" },
    { name: "Legal Aid Council", kind: "legal" as const, city: "Lagos", aliases: ["legal aid"], envEmail: "DEMO_LEGAL_PAYPAL_EMAIL", fallback: "legal@business.example.com" },
    { name: "Adaeze Foundation (demo public figure)", kind: "public_figure" as const, city: "Lagos", aliases: ["adaeze"], envEmail: "DEMO_FIGURE_PAYPAL_EMAIL", fallback: "figure@business.example.com" },
  ],
  historyAmounts: [40, 60, 50],
};

export function demoEmail(u: { envEmail: string; fallback: string }): string {
  return process.env[u.envEmail] || u.fallback;
}
