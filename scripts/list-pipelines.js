// Verify Streak pipeline exists
const STREAK_API_KEY = "strk_LitL1WFFkGdFSuTpHRQDNYIZQ2l";
const STREAK_PIPELINE_KEY = "agxzfm1haWxmb29nYWVyNQsSDE9yZ2FuaXphdGlvbiIOYXJjaGVmb3JnZS5jb20MCxIIV29ya2Zsb3cYgIClntjvsAoM";

async function verifyPipeline() {
    const authHeader = `Basic ${Buffer.from(STREAK_API_KEY + ":").toString("base64")}`;

    console.log("Step 1: Get ALL pipelines...\n");

    try {
        // First, get all pipelines to see what we have access to
        const response = await fetch(
            `https://api.streak.com/v1/pipelines`,
            {
                headers: {
                    "Authorization": authHeader,
                },
            }
        );

        console.log("Status:", response.status);
        const text = await response.text();

        if (response.ok) {
            const pipelines = JSON.parse(text);
            console.log("\n✅ Found pipelines:", pipelines.length);
            pipelines.forEach((p, i) => {
                console.log(`\n${i + 1}. ${p.name}`);
                console.log(`   Key: ${p.pipelineKey}`);
                console.log(`   Stages: ${p.stages ? Object.keys(p.stages).length : 0}`);
            });

            // Check if our pipeline key exists
            const ourPipeline = pipelines.find(p => p.pipelineKey === STREAK_PIPELINE_KEY);
            if (ourPipeline) {
                console.log(`\n\n✅ OUR PIPELINE FOUND: "${ourPipeline.name}"`);
                console.log(`Key: ${ourPipeline.pipelineKey}`);
            } else {
                console.log(`\n\n❌ Pipeline key ${STREAK_PIPELINE_KEY} NOT FOUND`);
                console.log("Available keys:");
                pipelines.forEach(p => console.log(`  - ${p.pipelineKey} (${p.name})`));
            }
        } else {
            console.log("Error:", text);
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}

verifyPipeline();
