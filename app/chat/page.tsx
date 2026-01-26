import { Metadata, Viewport } from "next"
import { MobileChatClient } from "./mobile-chat-client"

export const metadata: Metadata = {
    title: "SoulPrint Chat",
    description: "Chat with your AI companion",
}

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
}

export default function ChatPage() {
    return <MobileChatClient />
}
