"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { createClient } from "@/utils/supabase/server";
import type { ActionResponse } from "@/types/database";
import {
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from "../schemas/authSchemas";

function getZodErrorMessage(error: ZodError<unknown>) {
  return error.issues[0]?.message ?? "Validation failed";
}

export async function signIn(
  input: SignInInput
): Promise<ActionResponse> {
  try {
    const validatedInput = signInSchema.parse(input);
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: validatedInput.email,
      password: validatedInput.password,
    });

    if (error) {
      console.error("Error signing in:", error);
      return { success: false, error: error.message ?? "Failed to sign in" };
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: getZodErrorMessage(error) };
    }
    console.error("Unexpected error in signIn:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function signUp(
  input: SignUpInput
): Promise<ActionResponse> {
  try {
    const validatedInput = signUpSchema.parse(input);
    const supabase = await createClient();

    const { error } = await supabase.auth.signUp({
      email: validatedInput.email,
      password: validatedInput.password,
    });

    if (error) {
      console.error("Error signing up:", error);
      return { success: false, error: error.message ?? "Failed to sign up" };
    }

    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: getZodErrorMessage(error) };
    }
    console.error("Unexpected error in signUp:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function signOut(): Promise<ActionResponse> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Error signing out:", error);
      return { success: false, error: error.message ?? "Failed to sign out" };
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Unexpected error in signOut:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
