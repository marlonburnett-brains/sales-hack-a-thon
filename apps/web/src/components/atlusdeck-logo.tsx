import { cn } from "@/lib/utils";

interface AtlusDeckLogoProps {
  className?: string;
}

/**
 * AtlusDeck brand logo -- a 6-armed asterisk/starburst in purple.
 * Three crossing bars at 0deg, 60deg, and 120deg create the asterisk shape.
 * Arms have rounded ends (strokeLinecap="round") for an organic feel.
 */
export function AtlusDeckLogo({ className }: AtlusDeckLogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-8 w-8 text-[#7C6BF4]", className)}
      aria-hidden="true"
    >
      {/* 6 arms: 3 bars crossing through center at 60deg intervals */}
      <line
        x1="12"
        y1="2"
        x2="12"
        y2="22"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <line
        x1="3.34"
        y1="7"
        x2="20.66"
        y2="17"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <line
        x1="3.34"
        y1="17"
        x2="20.66"
        y2="7"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
