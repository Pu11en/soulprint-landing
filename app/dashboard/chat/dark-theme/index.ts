/**
 * SoulPrint Dark Theme Chat Components
 * 
 * Telegram-inspired dark mode chat interface with SoulPrint branding.
 * 
 * Usage:
 * ```tsx
 * import { 
 *   ChatContainerDark, 
 *   ChatMessageDark, 
 *   TypingIndicatorDark,
 *   ChatEmptyStateDark 
 * } from './dark-theme'
 * 
 * // In your component:
 * <ChatContainerDark
 *   soulprintName="My SoulPrint"
 *   inputValue={input}
 *   onInputChange={setInput}
 *   onSend={handleSend}
 *   isLoading={loading}
 *   backgroundStyle="ethereal" // or "default" | "neural"
 * >
 *   {messages.length === 0 ? (
 *     <ChatEmptyStateDark onSuggestionClick={handleSend} />
 *   ) : (
 *     <>
 *       {messages.map((msg, i) => (
 *         <ChatMessageDark key={i} message={msg} soulprintName="My SoulPrint" />
 *       ))}
 *       {loading && <TypingIndicatorDark />}
 *     </>
 *   )}
 * </ChatContainerDark>
 * ```
 */

export { ChatContainerDark, ChatEmptyStateDark } from '../chat-container-dark'
export { ChatMessageDark, TypingIndicatorDark } from '../chat-message-dark'
