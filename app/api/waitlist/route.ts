import { NextRequest, NextResponse } from "next/server"
import { sendConfirmationEmail } from "@/lib/email"

export const runtime = "nodejs"

const STREAK_API_KEY = process.env.STREAK_API_KEY
const STREAK_PIPELINE_KEY = process.env.STREAK_PIPELINE_KEY
const STREAK_TEAM_KEY = process.env.STREAK_TEAM_KEY

export async function POST(req: NextRequest) {
    try {
        const { name, email, ndaOptIn } = await req.json()

        // Validate inputs
        if (!name || !email || !email.includes("@")) {
            return NextResponse.json(
                { error: "Name and valid email are required" },
                { status: 400 }
            )
        }

        let streakSuccess = false
        let boxKey = null
        let contactCreated = false

        // Try to add to Streak CRM (but don't fail if it doesn't work)
        if (STREAK_API_KEY && STREAK_PIPELINE_KEY) {
            try {
                const authHeader = `Basic ${Buffer.from(STREAK_API_KEY + ":").toString("base64")}`

                const getTeamKey = async () => {
                    if (STREAK_TEAM_KEY) return STREAK_TEAM_KEY

                    try {
                        const teamResponse = await fetch(
                            "https://api.streak.com/api/v2/users/me/teams",
                            {
                                method: "GET",
                                headers: {
                                    "Authorization": authHeader,
                                },
                            }
                        )

                        if (!teamResponse.ok) {
                            const teamText = await teamResponse.text()
                            console.error("Streak teams API error:", {
                                status: teamResponse.status,
                                response: teamText,
                            })
                            return null
                        }

                        const teams = await teamResponse.json()
                        return Array.isArray(teams) && teams.length > 0 ? teams[0].teamKey : null
                    } catch (teamError) {
                        console.error("Streak teams lookup failed:", teamError)
                        return null
                    }
                }

                // Create a box in the Streak pipeline
                const boxResponse = await fetch(
                    `https://api.streak.com/api/v2/pipelines/${STREAK_PIPELINE_KEY}/boxes`,
                    {
                        method: "POST",
                        headers: {
                            "Authorization": authHeader,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            name: `${name} - ${email}`,
                            notes: `Waitlist signup\nName: ${name}\nEmail: ${email}\nAgreed to NDA: ${ndaOptIn ? "Yes" : "No"}\nDate: ${new Date().toISOString()}`,
                        }),
                    }
                )

                if (boxResponse.ok) {
                    const box = await boxResponse.json()
                    streakSuccess = true
                    boxKey = box.boxKey

                    // Create contact with email + name in Streak
                    try {
                        const teamKey = await getTeamKey()

                        if (teamKey) {
                            const contactResponse = await fetch(
                                `https://api.streak.com/api/v2/teams/${teamKey}/contacts`,
                                {
                                    method: "POST",
                                    headers: {
                                        "Authorization": authHeader,
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                        name,
                                        emailaddresses: [email],
                                        getIfExisting: true,
                                    }),
                                }
                            )

                            if (contactResponse.ok) {
                                contactCreated = true
                            } else {
                                const contactText = await contactResponse.text()
                                console.error("Streak contact API error:", {
                                    status: contactResponse.status,
                                    response: contactText,
                                })
                            }
                        }
                    } catch (contactError) {
                        console.error("Streak contact integration failed:", contactError)
                    }
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
        }

        // Send confirmation email - this is the critical part
        try {
            await sendConfirmationEmail(email, name)
        } catch (emailError) {
            console.error("Failed to send confirmation email:", emailError)
            // Still return success - user is registered even if email fails
        }

        return NextResponse.json({
            success: true,
            message: "Successfully added to waitlist! Check your email for confirmation.",
            boxKey: boxKey,
            streakIntegrated: streakSuccess,
            streakContactCreated: contactCreated,
        })
    } catch (error) {
        console.error("Waitlist API error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
