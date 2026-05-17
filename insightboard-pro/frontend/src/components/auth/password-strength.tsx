"use client";

import { cn } from "@/lib/utils";

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

function getStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!password) {
    return { score: 0, label: "", color: "bg-slate-700" };
  }

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 1, label: "Weak", color: "bg-red-500" };
  if (score <= 2) return { score: 2, label: "Fair", color: "bg-amber-500" };
  if (score <= 3) return { score: 3, label: "Good", color: "bg-blue-500" };
  return { score: 4, label: "Strong", color: "bg-emerald-500" };
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const { score, label, color } = getStrength(password);

  if (!password) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              level <= score ? color : "bg-slate-700"
            )}
          />
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Password strength:{" "}
        <span className="text-slate-400">{label}</span>
      </p>
    </div>
  );
}
