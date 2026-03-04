"use client";

import React from "react";
import { ThemeToggle } from "./ThemeToggle";
import { usePathname } from "next/navigation";

export default function Topbar() {
  const pathname = usePathname();
  
  // Create a readable title from pathname
  const title = pathname === "/" 
    ? "Dashboard" 
    : pathname.split("/").filter(Boolean).map(segment => segment.charAt(0).toUpperCase() + segment.slice(1)).join(" / ");

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-background/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      </div>

      <div className="flex items-center gap-3">

        <ThemeToggle />
      </div>
    </header>
  );
}
