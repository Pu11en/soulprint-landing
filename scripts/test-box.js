// Test Streak box creation with correct URL
const STREAK_API_KEY = "strk_LitL1WFFkGdFSuTpHRQDNYIZQ2l";
const STREAK_PIPELINE_KEY = "agxzfm1haWxmb29nYWVyNQsSDE9yZ2FuaXphdGlvbiIOYXJjaGVmb3JnZS5jb20MCxIIV29ya2Zsb3cYgIClntjvsAoM";

async function testBoxCreation() {
    const authHeader = `Basic ${Buffer.from(STREAK_API_KEY + ":").toString("base64")}`;

    console.log("Testing Streak Box Creation with CORRECT URL...\n");

    try {
        const response = await fetch(
            `https://api.streak.com/v1/pipelines/${STREAK_PIPELINE_KEY}/boxes`,  // CORRECT URL!
            {
                method: "POST",
                headers: {
                    "Authorization": authHeader,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: "Test Waitlist Entry",
                    notes: "Testing correct API URL",
                }),
            }
        );

        console.log("Status:", response.status, response.statusText);
        const text = await response.text();
        console.log("Response:", text.substring(0, 1000));

        if (response.ok) {
            const data = JSON.parse(text);
            console.log("\n✅ SUCCESS! Box created:");
            console.log("  Box Key:", data.boxKey);
            console.log("  Name:", data.name);
            console.log("  Stage:", data.stage || data.stageKey);
        } else {
            console.log("\n❌ FAILED");
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}

testBoxCreation();
