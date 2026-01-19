import { NextRequest, NextResponse } from "next/server"
import { sendConfirmationEmail } from "@/lib/email"

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

        let streakSuccess = false
        let boxKey = null

        // Try to add to Streak CRM (but don't fail if it doesn't work)
        if (STREAK_API_KEY && STREAK_PIPELINE_KEY) {
            try {
                const authHeader = `Basic ${Buffer.from(STREAK_API_KEY + ":").toString("base64")}`

                // Create a box in the Streak pipeline
                const boxResponse = await fetch(
                    `https://api.streak.com/v1/pipelines/${STREAK_PIPELINE_KEY}/boxes`,
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

                if (boxResponse.ok) {
                    const box = await boxResponse.json()
                    streakSuccess = true
                    boxKey = box.boxKey
                    console.log("Streak: Lead added successfully", { boxKey })
                } else {
                    const responseText = await boxResponse.text()
                    console.error("Streak API error:", {
                        status: boxResponse.status,
                        response: responseText,
                    })
                    // Continue anyway - we'll still send the email
                }
            } catch (streakError) {
                console.error("Streak integration failed:", streakError)
                // Continue anyway - we'll still send the email
            }
        } else {
            console.warn("Streak not configured - skipping CRM integration")
        }

        // Send confirmation email - this is the critical part
        try {
            await sendConfirmationEmail(email, name)
            console.log(`Confirmation email sent to ${email}`)
        } catch (emailError) {
            console.error("Failed to send confirmation email:", emailError)
            // Still return success - user is registered even if email fails
        }

        return NextResponse.json({
            success: true,
            message: "Successfully added to waitlist! Check your email for confirmation.",
            boxKey: boxKey,
            streakIntegrated: streakSuccess,
        })
    } catch (error) {
        console.error("Waitlist API error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
