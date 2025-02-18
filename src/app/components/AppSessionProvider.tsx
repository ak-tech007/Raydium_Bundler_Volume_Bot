"use client";

import { ReactNode } from "react";
import { SessionProvider, useSession } from "next-auth/react";

export default function AppSessionProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

// Auth Component for Protected Routes
export function Auth({ children }: { children: ReactNode }) {
  const { status } = useSession({ required: true });

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  return children;
}
