// The app's mark: a simple leaf, echoing the 🌱 coach avatar used
// throughout onboarding/chat (ChatOnboardingStep.tsx, OnboardingUploadStep.tsx)
// so the brand and the "coach" character read as the same identity
// instead of two unrelated visual ideas. One inline SVG, no icon
// library — colored via `currentColor` so it inherits `text-accent`
// (index.css) wherever it's placed, same as every other accent use.
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M12 21.5C7 21.5 3 17.5 3 11.5C3 6 7 2.5 12 2.5C14 2.5 15.5 3 15.5 3C15.5 3 16 5 16 7.5C16 14 12 17.5 5.5 17.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
