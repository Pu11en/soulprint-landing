import { NextRequest, NextResponse } from "next/server"

const STREAK_API_KEY = process.env.STREAK_API_KEY
const STREAK_PIPELINE_KEY = process.env.STREAK_PIPELINE_KEY

export async function POST(req: NextRequest) {
    try {
        const { name, email } = await req.json()

        // Validate inputs
        if (!name || !email || !email.includes("@")) {
            return NextResponse.json(
                { error: "Name and valid email are required" },
                { status: 400 }
            )
        }

        if (!STREAK_API_KEY || !STREAK_PIPELINE_KEY) {
            console.error("Missing Streak configuration")
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500 }
            )
        }

        const authHeader = `Basic ${Buffer.from(STREAK_API_KEY + ":").toString("base64")}`

        // Create a box in the Streak pipeline (this triggers automations)
        const boxResponse = await fetch(
            `https://www.streak.com/api/v1/pipelines/${STREAK_PIPELINE_KEY}/boxes`,
            {
                method: "POST",
                headers: {
                    "Authorization": authHeader,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: `${name} - ${email}`,
                    notes: `Waitlist signup\nName: ${name}\nEmail: ${email}\nAgreed to NDA: Yes\nDate: ${new Date().toISOString()}`,
                }),
            }
        )

        const responseText = await boxResponse.text()
        console.log("Streak API response:", {
            status: boxResponse.status,
            statusText: boxResponse.statusText,
            body: responseText.substring(0, 500), // Log first 500 chars
        })

        if (!boxResponse.ok) {
            console.error("Streak API error:", {
                status: boxResponse.status,
                response: responseText,
            })

            return NextResponse.json(
                { error: "Failed to add to waitlist. Please try again." },
                { status: 500 }
            )
        }

        const box = JSON.parse(responseText)

        // Trigger n8n workflow to send confirmation email
        try {
            const n8nWebhookUrl = process.env.N8N_WAITLIST_WEBHOOK_URL;
            if (n8nWebhookUrl) {
                await fetch(n8nWebhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email }),
                })
            } else {
                console.warn("N8N_WAITLIST_WEBHOOK_URL not configured")
            }
        } catch (emailError) {
            console.error("Failed to trigger email webhook:", emailError)
            // Don't fail the request if email fails - user is still on waitlist
        }

        return NextResponse.json({
            success: true,
            message: "Successfully added to waitlist! Check your email for confirmation.",
            boxKey: box.boxKey,
        })
    } catch (error) {
        console.error("Waitlist API error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
