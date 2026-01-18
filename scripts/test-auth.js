// Test basic Streak API auth
const STREAK_API_KEY = process.env.STREAK_API_KEY || "strk_LitL1WFFkGdFSuTpHRQDNYIZQ2l";

async function testAuth() {
    const authHeader = `Basic ${Buffer.from(STREAK_API_KEY + ":").toString("base64")}`;

    console.log("Testing Streak API Authentication...");
    console.log("API Key:", STREAK_API_KEY);
    console.log("\n---\n");

    // Test the user/me endpoint
    try {
        const response = await fetch(
            "https://api.streak.com/v1/users/me",
            {
                headers: {
                    "Authorization": authHeader,
                },
            }
        );

        console.log("Status:", response.status);
        const contentType = response.headers.get("content-type");
        console.log("Content-Type:", contentType);

        const text = await response.text();

        if (response.ok) {
            const data = JSON.parse(text);
            console.log("\n✅ AUTH SUCCESS!");
            console.log("User Email:", data.email);
            console.log("User Key:", data.userKey);

            // Now try to list pipelines
            console.log("\n\nFetching pipelines...\n");
            const pipesResp = await fetch(
                "https://api.streak.com/v1/pipelines",
                { headers: { "Authorization": authHeader } }
            );

            if (pipesResp.ok) {
                const pipes = await pipesResp.json();
                console.log("✅ Found", pipes.length, "pipelines:");
                pipes.forEach(p => {
                    console.log(`\n  - ${p.name}`);
                    console.log(`    Key: ${p.pipelineKey}`);
                });
            }
        } else {
            console.log("\n❌ AUTH FAILED");
            console.log("Response:", text.substring(0, 500));
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}

testAuth();
