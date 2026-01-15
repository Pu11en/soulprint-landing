"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { generateApiKey, listApiKeys, revokeApiKey } from "@/app/actions/api-keys"
import { testAgentSession } from "@/app/actions/test-agent"
import { Copy, Trash2, Key, Terminal, Loader2 } from "lucide-react"

interface ApiKey {
    id: string
    label: string
    created_at: string
    last_used_at: string | null
    status?: 'active' | 'inactive'
    display_key?: string
}

export default function BotPage() {
    const [keys, setKeys] = useState<ApiKey[]>([])
    const [newKey, setNewKey] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    // Manual Key Test State
    const [testMessage, setTestMessage] = useState("")
    const [testResponse, setTestResponse] = useState("")
    const [testing, setTesting] = useState(false)

    // Session Test State
    const [sessionTestMessage, setSessionTestMessage] = useState("")
    const [sessionTestResponse, setSessionTestResponse] = useState("")
    const [sessionTesting, setSessionTesting] = useState(false)

    useEffect(() => {
        loadKeys()
    }, [])

    async function loadKeys() {
        const result = await listApiKeys()
        if (result.keys) {
            setKeys(result.keys)
        }
    }

    async function handleCreateKey() {
        setLoading(true)
        const result = await generateApiKey("My SoulPrint Key")
        setLoading(false)

        if (result.apiKey) {
            setNewKey(result.apiKey)
            loadKeys()
        }
    }

    async function handleRevokeKey(id: string) {
        if (confirm("Are you sure you want to revoke this key? It will stop working immediately.")) {
            await revokeApiKey(id)
            loadKeys()
        }
    }

    // Test with Manual Key (External Simulation)
    async function handleTestKey() {
        if (!newKey && keys.length === 0) return
        setTesting(true)
        setTestResponse("")

        const keyToUse = newKey

        if (!keyToUse) {
            setTestResponse("Please generate a new key to test (for security, we don't store raw keys to display them again).")
            setTesting(false)
            return
        }

        try {
            const res = await fetch("/api/llm/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${keyToUse}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        { role: "user", content: testMessage || "Hello, who are you?" }
                    ]
                })
            })

            const data = await res.json()
            if (data.error) {
                setTestResponse(`Error: ${data.error}`)
            } else {
                setTestResponse(data.choices[0].message.content)
            }
        } catch (e) {
            setTestResponse("Request failed")
        } finally {
            setTesting(false)
        }
    }

    // Test with Session (Internal Test)
    async function handleSessionTest() {
        if (!sessionTestMessage) return
        setSessionTesting(true)
        setSessionTestResponse("")

        const result = await testAgentSession(sessionTestMessage)
        if (result.error) {
            setSessionTestResponse("Error: " + result.error)
        } else {
            setSessionTestResponse(result.content || "No response")
        }
        setSessionTesting(false)
    }

    return (
        <div className="max-w-4xl space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-white">Bot Integration</h1>
                <p className="text-gray-400">Manage your SoulPrint API keys to use your personalized AI in other apps.</p>
            </div>

            {/* Key Generation */}
            <div className="rounded-xl border border-[#222] bg-[#111] p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-white">API Keys</h2>
                        <p className="text-sm text-gray-400">These keys allow access to your SoulPrint-wrapped GPT-4.</p>
                    </div>
                    <Button onClick={handleCreateKey} disabled={loading} className="bg-orange-600 hover:bg-orange-700">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create New Key
                    </Button>
                </div>

                {newKey && (
                    <div className="mt-6 rounded-lg border border-orange-500/30 bg-orange-500/10 p-4">
                        <p className="mb-2 text-sm font-medium text-orange-400">✨ New Key Generated (Copy it now, you won't see it again!)</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 rounded bg-black/50 p-3 font-mono text-sm text-white">
                                {newKey}
                            </code>
                            <Button size="icon" variant="ghost" onClick={() => navigator.clipboard.writeText(newKey)}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

                <div className="mt-6 space-y-2">
                    {keys.map((key) => (
                        <div key={key.id} className="flex items-center justify-between rounded-lg border border-[#222] bg-[#0A0A0A] p-4">
                            <div className="flex items-center gap-3">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${key.status === 'inactive' ? 'bg-yellow-500/20' : 'bg-green-500/20'}`}>
                                    <Key className={`h-4 w-4 ${key.status === 'inactive' ? 'text-yellow-500' : 'text-green-500'}`} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="font-medium text-white">{key.label || "SoulPrint Key"}</div>
                                        {key.status === 'inactive' && (
                                            <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] text-yellow-500">
                                                Inactive (Finish SoulPrint)
                                            </span>
                                        )}
                                        {key.status === 'active' && (
                                            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] text-green-500">
                                                Active
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500">Created: {new Date(key.created_at).toLocaleDateString()}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {key.display_key ? (
                                    <div className="flex items-center gap-2 mr-2">
                                        <code className="text-[10px] bg-black/50 px-2 py-1 rounded text-orange-200/80 font-mono hidden md:block">
                                            {key.display_key}
                                        </code>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 text-gray-400 hover:text-white"
                                            onClick={() => navigator.clipboard.writeText(key.display_key!)}
                                            title="Copy Key"
                                        >
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="text-xs text-gray-500 font-mono mr-2">sk-soulprint-...{key.id.slice(0, 4)}</div>
                                )}
                                <Button size="icon" variant="ghost" className="text-red-400 hover:bg-red-900/20 hover:text-red-300" onClick={() => handleRevokeKey(key.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    {keys.length === 0 && !loading && (
                        <div className="text-center text-sm text-gray-500 py-4">No keys generated yet.</div>
                    )}
                </div>
            </div>

            {/* Session Test Console */}
            <div className="rounded-xl border border-[#222] bg-[#111] p-6">
                <h2 className="mb-4 text-lg font-semibold text-white flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    Test Your Agent (Session)
                </h2>
                <div className="space-y-4">
                    <p className="text-sm text-gray-400">
                        Test your SoulPrint agent immediately using your current login session. (No API Key needed)
                    </p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={sessionTestMessage}
                            onChange={(e) => setSessionTestMessage(e.target.value)}
                            placeholder="Ask your SoulPrint something..."
                            className="flex-1 rounded-md border border-[#333] bg-[#0A0A0A] px-4 py-2 text-white placeholder:text-gray-600 focus:border-orange-500 focus:outline-none"
                        />
                        <Button onClick={handleSessionTest} disabled={sessionTesting} className="bg-gray-700 hover:bg-gray-600">
                            {sessionTesting ? "Thinking..." : "Send"}
                        </Button>
                    </div>
                    {sessionTestResponse && (
                        <div className="rounded-md bg-[#0A0A0A] p-4 text-sm text-gray-300 whitespace-pre-wrap border border-[#222]">
                            {sessionTestResponse}
                        </div>
                    )}
                </div>
            </div>

            {/* New Key Test Console (Only if newKey) */}
            {newKey && (
                <div className="rounded-xl border border-[#222] bg-[#111] p-6">
                    <h2 className="mb-4 text-lg font-semibold text-white flex items-center gap-2">
                        <Terminal className="h-5 w-5" />
                        Test New API Key
                    </h2>
                    <div className="space-y-4">
                        <p className="text-sm text-gray-400">
                            Validate your NEW manual key before you lose it!
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={testMessage}
                                onChange={(e) => setTestMessage(e.target.value)}
                                placeholder="Type a message to test..."
                                className="flex-1 rounded-md border border-[#333] bg-[#0A0A0A] px-4 py-2 text-white placeholder:text-gray-600 focus:border-orange-500 focus:outline-none"
                            />
                            <Button onClick={handleTestKey} disabled={testing}>
                                {testing ? "Sending..." : "Send"}
                            </Button>
                        </div>
                        {testResponse && (
                            <div className="rounded-md bg-[#0A0A0A] p-4 text-sm text-gray-300 whitespace-pre-wrap border border-[#222]">
                                {testResponse}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
