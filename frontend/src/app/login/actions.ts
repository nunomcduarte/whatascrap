"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function withError(msg: string): never {
  redirect(`/login?error=${encodeURIComponent(msg)}`);
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (error) withError(error.message);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });
  if (error) withError(error.message);
  // If email confirmation is enabled in Supabase, user must verify before /
  // works. For dev: Supabase Dashboard → Authentication → Email → disable
  // "Confirm email" to skip the verification step.
  revalidatePath("/", "layout");
  redirect("/");
}
