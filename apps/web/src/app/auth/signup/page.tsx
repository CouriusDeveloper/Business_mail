"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    orgName: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateField(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1. Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          name: formData.name,
          org_name: formData.orgName,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      // The organization and user profile creation will be handled
      // by a Supabase Edge Function / database trigger on auth.users insert.
      // For now, redirect to dashboard where the onboarding flow will handle it.
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Registrieren</CardTitle>
          <CardDescription>
            Erstellen Sie Ihr Konto und Ihre Organisation
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="orgName">Organisationsname</Label>
              <Input
                id="orgName"
                placeholder="z.B. Steuerkanzlei Müller"
                value={formData.orgName}
                onChange={(e) => updateField("orgName", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Ihr Name</Label>
              <Input
                id="name"
                placeholder="Max Mustermann"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@beispiel.de"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mindestens 8 Zeichen"
                minLength={8}
                value={formData.password}
                onChange={(e) => updateField("password", e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Wird erstellt..." : "Konto erstellen"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Bereits registriert?{" "}
              <Link
                href="/auth/login"
                className="text-primary underline-offset-4 hover:underline"
              >
                Anmelden
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
