import Link from "next/link";
import { AuthNav } from "@/components/nav/auth-nav";

interface FloatingNavbarProps {
  children?: React.ReactNode;
}

export function FloatingNavbar({ children }: FloatingNavbarProps) {
  return (
    <nav className="fixed top-4 left-4 right-4 z-50">
      <div className="max-w-6xl mx-auto border-2 border-foreground bg-background shadow-neo">
        <div className="px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-bold text-xl tracking-tight">
              webhooks.cc
            </Link>
            {children}
          </div>
          <AuthNav />
        </div>
      </div>
    </nav>
  );
}
