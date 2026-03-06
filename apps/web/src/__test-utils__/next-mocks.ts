// Shared helpers for Next.js mock state.
// vi.mock() calls must be in each test file directly (hoisting requirement).
import { type Mock, vi } from "vitest";

let _pathname = "/";

export const mockPush: Mock = vi.fn();
export const mockReplace: Mock = vi.fn();

export function setMockPathname(path: string) {
  _pathname = path;
}

export function getMockPathname() {
  return _pathname;
}
