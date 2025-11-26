import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const webhookUrl = process.env.NEXT_PUBLIC_N8N_SOULPRINT_WEBHOOK;

        if (!webhookUrl) {
            console.error("Webhook URL not configured");
            return NextResponse.json(
                { error: "Configuration error" },
                { status: 500 }
            );
        }

        // Forward the request to the n8n webhook
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            console.error("Webhook request failed:", response.status, response.statusText);
            return NextResponse.json(
                { error: "Failed to submit soulprint" },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error("Error in soulprint submit API:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}