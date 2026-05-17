import { BarChart3 } from "lucide-react";
import Link from "next/link";

interface AuthShellProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export function AuthShell({ children, title, subtitle }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0f1a] px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59, 130, 246, 0.15), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(59, 130, 246, 0.08), transparent)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <Link
        href="/"
        className="relative z-10 mb-8 flex items-center gap-2 text-slate-400 transition-colors hover:text-white"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B82F6]">
          <BarChart3 className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-medium">InsightBoard</span>
      </Link>

      <div className="relative z-10 w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-8 shadow-2xl shadow-black/20 backdrop-blur-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
