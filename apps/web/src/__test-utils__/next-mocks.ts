import { vi } from "vitest";

// Stores for controlling mock behavior in tests
let currentPathname = "/";
const pushFn = vi.fn();
const replaceFn = vi.fn();
const prefetchFn = vi.fn();
const backFn = vi.fn();

export function setMockPathname(path: string) {
  currentPathname = path;
}

export function getMockRouter() {
  return { push: pushFn, replace: replaceFn, prefetch: prefetchFn, back: backFn };
}

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({
    push: pushFn,
    replace: replaceFn,
    prefetch: prefetchFn,
    back: backFn,
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/link as a simple anchor
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require("react");
    return React.createElement("a", { href, ...props }, children);
  },
}));
