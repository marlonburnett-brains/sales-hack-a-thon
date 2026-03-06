import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Ensure Radix UI portals and other DOM artifacts are cleaned up between tests
afterEach(() => {
  cleanup();
});
