// Test script to verify Streak API connectivity
const STREAK_API_KEY = "strk_LitL1WFFkGdFSuTpHRQDNYIZQ2l";

async function testStreakAPI() {
    const authHeader = `Basic ${Buffer.from(STREAK_API_KEY + ":").toString("base64")}`;

    console.log("Testing Streak API...\n");

    // Test 1: Get teams
    console.log("1. Fetching teams...");
    try {
        const teamsResponse = await fetch("https://api.streak.com/api/v1/teams", {
            headers: { "Authorization": authHeader },
        });

        console.log(`Status: ${teamsResponse.status}`);
        const teamsData = await teamsResponse.text();
        console.log("Response:", teamsData);

        if (teamsResponse.ok) {
            const teams = JSON.parse(teamsData);
            if (teams && teams.length > 0) {
                const teamKey = teams[0].teamKey;
                console.log(`\n✅ Team Key: ${teamKey}\n`);

                // Test 2: Create contact
                console.log("2. Creating test contact...");
                const contactResponse = await fetch(
                    "https://api.streak.com/api/v2/contacts",
                    {
                        method: "POST",
                        headers: {
                            "Authorization": authHeader,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            teamKey,
                            emailAddresses: ["test@example.com"],
                            getIfExisting: true,
                        }),
                    }
                );

                console.log(`Status: ${contactResponse.status}`);
                const contactData = await contactResponse.text();
                console.log("Response:", contactData);

                if (contactResponse.ok) {
                    console.log("\n✅ Contact created successfully!");
                } else {
                    console.log("\n❌ Failed to create contact");
                }
            }
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

testStreakAPI();
