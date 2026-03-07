"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * A thin progress bar at the top of the viewport that animates
 * whenever a client-side navigation is in progress.
 *
 * It detects navigation by watching for pathname changes:
 * - On click of a Link, pathname won't change immediately because
 *   the server component is loading. But loading.tsx triggers a
 *   React transition which we detect via the pathname eventually changing.
 *
 * We use a simpler approach: intercept link clicks to show the bar,
 * and hide it when pathname changes (meaning navigation completed).
 */
export function NavProgress() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    // When pathname changes, navigation is complete
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      setIsNavigating(false);
    }
  }, [pathname]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Only track internal navigation links
      if (href.startsWith("/") && href !== pathname) {
        setIsNavigating(true);
      }
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () =>
      document.removeEventListener("click", handleClick, { capture: true });
  }, [pathname]);

  if (!isNavigating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5">
      <div className="h-full w-full animate-nav-progress bg-blue-600" />
    </div>
  );
}
