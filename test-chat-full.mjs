// Full chat test using service role to get API key
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = "79898043-3620-40ee-9e49-58a0e1ea4e2c";

async function testChat() {
  console.log("1. Getting API key with service role...");
  
  const { data: apiKeys, error: keyError } = await supabaseAdmin
    .from("api_keys")
    .select("*")
    .eq("user_id", userId);

  if (keyError) {
    console.error("❌ Error:", keyError.message);
    return;
  }

  if (!apiKeys || apiKeys.length === 0) {
    console.log("❌ No API keys found");
    return;
  }

  console.log("✅ Found API key:");
  const key = apiKeys[0];
  console.log("   Columns:", Object.keys(key).join(", "));
  console.log("   encrypted_key:", key.encrypted_key ? key.encrypted_key.substring(0, 30) + "..." : "NONE");
  console.log("   key_hash:", key.key_hash ? key.key_hash.substring(0, 20) + "..." : "NONE");
  console.log("   status:", key.status);

  if (!key.encrypted_key) {
    console.log("\n⚠️ No encrypted_key stored. The raw key was only shown at creation time.");
    console.log("   Drew needs to generate a new API key in the dashboard to get the raw key.");
    return;
  }

  const rawKey = key.encrypted_key;
  console.log("\n2. Testing chat API with key:", rawKey.substring(0, 25) + "...");

  try {
    const response = await fetch("http://localhost:3000/api/llm/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${rawKey}`
      },
      body: JSON.stringify({
        messages: [
          { role: "user", content: "Hello! Can you introduce yourself briefly?" }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("❌ Chat API error:", response.status, error);
      return;
    }

    console.log("✅ Chat API responded! Reading stream...\n");
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter(line => line.startsWith("data: "));
      
      for (const line of lines) {
        const data = line.replace("data: ", "");
        if (data === "[DONE]") continue;
        
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || "";
          fullResponse += content;
          process.stdout.write(content);
        } catch {
          // Skip parse errors
        }
      }
    }

    console.log("\n\n✅ Chat test complete!");
    console.log("Response length:", fullResponse.length, "characters");

  } catch (error) {
    console.error("❌ Fetch error:", error.message);
  }
}

testChat().catch(console.error);
