// Direct test with the new API key
const STREAK_API_KEY = "strk_1UbS2cxkddnpseoW4cxcJjVUvtWW";

async function test() {
    // Use the API key directly as the username (curl style with -u flag)
    const auth = Buffer.from(STREAK_API_KEY + ":").toString("base64");

    console.log("Testing Streak API...");
    console.log("Key:", STREAK_API_KEY);
    console.log("Auth header:", auth);
    console.log("\n---\n");

    try {
        const response = await fetch("https://api.streak.com/v1/users/me", {
            method: "GET",
            headers: {
                "Authorization": `Basic ${auth}`,
                "User-Agent": "SoulPrint/1.0",
            },
        });

        console.log("Status:", response.status, response.statusText);

        const contentType = response.headers.get("content-type");
        console.log("Content-Type:", contentType);

        const text = await response.text();

        if (contentType && contentType.includes("application/json")) {
            const data = JSON.parse(text);
            console.log("\n✅ SUCCESS!");
            console.log("Email:", data.email);
            console.log("User Key:", data.userKey);

            // Now get pipelines
            console.log("\n\nFetching pipelines...");
            const pResp = await fetch("https://api.streak.com/v1/pipelines", {
                headers: {
                    "Authorization": `Basic ${auth}`,
                    "User-Agent": "SoulPrint/1.0",
                },
            });

            if (pResp.ok) {
                const pipes = await pResp.json();
                console.log("\nYour pipelines:");
                pipes.forEach((p, i) => {
                    console.log(`\n${i + 1}. ${p.name}`);
                    console.log(`   Key: ${p.pipelineKey}`);
                });
            }
        } else {
            console.log("\n❌ FAILED - Got HTML response");
            console.log("First 200 chars:", text.substring(0, 200));
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}

test();
