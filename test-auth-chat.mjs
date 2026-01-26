// Test auth + chat flow
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
    console.log("   Display Name:", profile.display_name || "Not set");
  }

  // Check soulprints
  console.log("\n3. Checking soulprints...");
  const { data: soulprints, error: spError } = await supabase
    .from("soulprints")
    .select("id, name, created_at")
    .eq("user_id", authData.user.id);

  if (spError) {
    console.error("❌ Soulprints error:", spError.message);
  } else if (!soulprints || soulprints.length === 0) {
    console.log("⚠️ No SoulPrints found - need to create one via onboarding");
  } else {
    console.log("✅ SoulPrints found:", soulprints.length);
    soulprints.forEach(sp => {
      console.log(`   - ${sp.name || 'Unnamed'} (${sp.id})`);
    });
  }

  // Check API keys
  console.log("\n4. Checking API keys...");
  const { data: apiKeys, error: keyError } = await supabase
    .from("api_keys")
    .select("id, name, created_at, key_preview")
    .eq("user_id", authData.user.id);

  if (keyError) {
    console.error("❌ API keys error:", keyError.message);
  } else if (!apiKeys || apiKeys.length === 0) {
    console.log("⚠️ No API keys found - need to generate one in dashboard");
  } else {
    console.log("✅ API keys found:", apiKeys.length);
    apiKeys.forEach(k => {
      console.log(`   - ${k.name || 'Unnamed'}: ${k.key_preview || 'no preview'}`);
    });
  }

  console.log("\n=== SUMMARY ===");
  const hasProfile = !!profile;
  const hasSoulprint = soulprints && soulprints.length > 0;
  const hasActiveSoulprint = profile?.current_soulprint_id;
  const hasApiKey = apiKeys && apiKeys.length > 0;

  console.log("Profile exists:", hasProfile ? "✅" : "❌");
  console.log("Has SoulPrint:", hasSoulprint ? "✅" : "❌");
  console.log("Active SoulPrint set:", hasActiveSoulprint ? "✅" : "❌");
  console.log("Has API key:", hasApiKey ? "✅" : "❌");
  
  if (hasActiveSoulprint && hasApiKey) {
    console.log("\n🟢 Ready to chat!");
  } else {
    console.log("\n🟡 Missing components for chat:");
    if (!hasSoulprint) console.log("   → Create a SoulPrint via /onboarding");
    if (!hasActiveSoulprint) console.log("   → Set an active SoulPrint");
    if (!hasApiKey) console.log("   → Generate an API key in dashboard");
  }
}

testAuthAndChat().catch(console.error);
