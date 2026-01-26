import { Metadata, Viewport } from "next"
import { AssistantChat } from "./assistant-chat"

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
    interactiveWidget: "resizes-content",
}

export default function ChatPage() {
    return <AssistantChat />
}
