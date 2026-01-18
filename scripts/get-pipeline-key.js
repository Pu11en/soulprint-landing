// Get the new API key from .env.local and list pipelines
require('dotenv').config({ path: '.env.local' });

const STREAK_API_KEY = process.env.STREAK_API_KEY;

async function listPipelines() {
    if (!STREAK_API_KEY) {
        console.log("❌ No STREAK_API_KEY found in .env.local");
        return;
    }

    const authHeader = `Basic ${Buffer.from(STREAK_API_KEY + ":").toString("base64")}`;

    console.log("Testing NEW Streak API key...");
    console.log("Key:", STREAK_API_KEY);
    console.log("\n---\n");

    try {
        // Get user info first
        const userResp = await fetch(
            "https://api.streak.com/v1/users/me",
            { headers: { "Authorization": authHeader } }
        );

        if (!userResp.ok) {
            console.log("❌ AUTH FAILED - Status:", userResp.status);
            const text = await userResp.text();
            console.log("Response:", text.substring(0, 500));
            return;
        }

        const user = await userResp.json();
        console.log("✅ AUTH SUCCESS!");
        console.log("Email:", user.email);
        console.log("\n---\n");

        // Get all pipelines
        console.log("Fetching your pipelines...\n");
        const pipesResp = await fetch(
            "https://api.streak.com/v1/pipelines",
            { headers: { "Authorization": authHeader } }
        );

        if (pipesResp.ok) {
            const pipes = await pipesResp.json();
            console.log(`✅ Found ${pipes.length} pipeline(s):\n`);

            pipes.forEach((p, i) => {
                console.log(`${i + 1}. ${p.name}`);
                console.log(`   Pipeline Key: ${p.pipelineKey}`);
                console.log(`   Stages: ${p.stages ? Object.keys(p.stages).length : 0}`);
                console.log(`   Boxes: ${p.totalBoxCount || 0}`);
                console.log("");
            });

            console.log("\n💡 Copy the Pipeline Key from the one you want to use for the waitlist");
            console.log("   and paste it into .env.local as STREAK_PIPELINE_KEY");
        } else {
            console.log("❌ Failed to get pipelines");
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}

listPipelines();
