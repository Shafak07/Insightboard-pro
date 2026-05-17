"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { PasswordStrength } from "@/components/auth/password-strength";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords do not match",
        description: "Please make sure both passwords are identical.",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Use at least 8 characters.",
      });
      return;
    }

    if (!acceptedTerms) {
      toast({
        variant: "destructive",
        title: "Terms required",
        description: "Please accept the terms of service to continue.",
      });
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    setLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: error.message,
      });
      return;
    }

    toast({
      title: "Check your email",
      description:
        "We sent a confirmation link. You can sign in once verified.",
    });
    router.push("/auth/login");
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start building dashboards in minutes"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-slate-300">
            Full name
          </Label>
          <Input
            id="fullName"
            type="text"
            placeholder="Jane Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
            className="border-slate-700 bg-slate-950/50 text-white placeholder:text-slate-600 focus-visible:ring-[#3B82F6]"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-300">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="border-slate-700 bg-slate-950/50 text-white placeholder:text-slate-600 focus-visible:ring-[#3B82F6]"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-300">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="border-slate-700 bg-slate-950/50 text-white placeholder:text-slate-600 focus-visible:ring-[#3B82F6]"
            disabled={loading}
          />
          <PasswordStrength password={password} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-slate-300">
            Confirm password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="border-slate-700 bg-slate-950/50 text-white placeholder:text-slate-600 focus-visible:ring-[#3B82F6]"
            disabled={loading}
          />
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="terms"
            checked={acceptedTerms}
            onCheckedChange={(v) => setAcceptedTerms(v === true)}
            disabled={loading}
            className="mt-0.5"
          />
          <Label
            htmlFor="terms"
            className="cursor-pointer text-sm font-normal leading-snug text-slate-400"
          >
            I agree to the{" "}
            <Link href="/terms" className="text-[#3B82F6] hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-[#3B82F6] hover:underline">
              Privacy Policy
            </Link>
          </Label>
        </div>

        <Button
          type="submit"
          className="w-full bg-[#3B82F6] hover:bg-[#2563EB]"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-transparent px-2 text-slate-600">or continue with</span>
        </div>
      </div>

      <OAuthButtons disabled={loading} />

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link
          href="/auth/login"
          className="text-[#3B82F6] hover:text-[#60A5FA]"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
