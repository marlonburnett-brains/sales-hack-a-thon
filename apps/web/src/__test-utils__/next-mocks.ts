// Shared helpers for Next.js mock state.
// vi.mock() calls must be in each test file directly (hoisting requirement).
import { vi } from "vitest";

let _pathname = "/";

export const mockPush = vi.fn();
export const mockReplace = vi.fn();

export function setMockPathname(path: string) {
  _pathname = path;
}

export function getMockPathname() {
  return _pathname;
}
