/**
 * @module services/supabaseClient
 * Shared Supabase client for authentication. Sessions persist in chunked SecureStore on native and in
 * `localStorage` on web. Throws at import time when the public Supabase URL or publishable key is missing.
 */
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { createSecureSessionStorage } from "./secureSessionStorage.js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.",
  );
}

const nativeSecureStorage = createSecureSessionStorage({ secureStore: SecureStore });

const storage = Platform.OS === "web"
  ? globalThis.localStorage
  : nativeSecureStorage;

/** @type {import('@supabase/supabase-js').SupabaseClient} */
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
