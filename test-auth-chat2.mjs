// Test auth + chat flow v2
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testAuthAndChat() {
  console.log("1. Signing in...");
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "kidquick360@gmail.com",
    password: "Dp071603!"
  });

  if (authError) {
    console.error("❌ Auth failed:", authError.message);
    return;
  }

  console.log("✅ Signed in as:", authData.user.email);
  console.log("   User ID:", authData.user.id);

  // Check profile
  console.log("\n2. Checking profile...");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  if (profileError) {
    console.error("❌ Profile error:", profileError.message);
  } else {
    console.log("✅ Profile found:");
    console.log("   Current SoulPrint ID:", profile.current_soulprint_id || "NONE");
    console.log("   Full profile:", JSON.stringify(profile, null, 2));
  }

  // Check soulprints - select all columns
  console.log("\n3. Checking soulprints...");
  const { data: soulprints, error: spError } = await supabase
    .from("soulprints")
    .select("*")
    .eq("user_id", authData.user.id);

  if (spError) {
    console.error("❌ Soulprints error:", spError.message);
  } else if (!soulprints || soulprints.length === 0) {
    console.log("⚠️ No SoulPrints found");
  } else {
    console.log("✅ SoulPrints found:", soulprints.length);
    soulprints.forEach((sp, i) => {
      console.log(`\n   SoulPrint ${i + 1}:`);
      console.log(`   ID: ${sp.id}`);
      console.log(`   Columns:`, Object.keys(sp).join(", "));
      if (sp.soulprint_data) {
        console.log(`   Has soulprint_data: ✅`);
        const data = sp.soulprint_data;
        console.log(`   Archetype: ${data.archetype || 'not set'}`);
        console.log(`   Name: ${data.name || data.companion_name || 'not set'}`);
      }
    });
  }

  // Check API keys - select all columns
  console.log("\n4. Checking API keys...");
  const { data: apiKeys, error: keyError } = await supabase
    .from("api_keys")
    .select("*")
    .eq("user_id", authData.user.id);

  if (keyError) {
    console.error("❌ API keys error:", keyError.message);
  } else if (!apiKeys || apiKeys.length === 0) {
    console.log("⚠️ No API keys found");
  } else {
    console.log("✅ API keys found:", apiKeys.length);
    apiKeys.forEach((k, i) => {
      console.log(`   Key ${i + 1} columns:`, Object.keys(k).join(", "));
    });
  }

  // Check what's needed
  console.log("\n=== CHAT READINESS ===");
  const hasSoulprint = soulprints && soulprints.length > 0;
  const hasActiveSoulprint = profile?.current_soulprint_id;
  const hasApiKey = apiKeys && apiKeys.length > 0;

  if (hasActiveSoulprint && hasApiKey) {
    console.log("🟢 Account is ready for chat!");
    // Try to get the actual API key value if it's stored (usually it's hashed)
    console.log("\nTo test chat, you need the raw API key (sk-soulprint-...)");
    console.log("This is only shown once when created. If you don't have it, generate a new one.");
  } else {
    console.log("🟡 Missing:");
    if (!hasSoulprint) console.log("   → No SoulPrint data");
    if (!hasActiveSoulprint) console.log("   → No active SoulPrint selected");
    if (!hasApiKey) console.log("   → No API key generated");
  }
}

testAuthAndChat().catch(console.error);
