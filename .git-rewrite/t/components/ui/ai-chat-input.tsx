"use client"

import * as React from "react"
import { useState, useEffect, useRef, useCallback } from "react";
import { Lightbulb, Mic, Globe, Paperclip, Send } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

const PLACEHOLDERS = [
  "Ask me anything...",
  "What's on your mind?",
  "Search your memories...",
  "Tell me about your day",
  "What do you want to remember?",
  "How can I help you?",
];

interface AIChatInputProps {
  onSubmit?: (value: string) => void;
  onVoiceStart?: () => void;
  isLoading?: boolean;
  darkMode?: boolean;
}

const AIChatInput = ({ onSubmit, onVoiceStart, isLoading, darkMode = true }: AIChatInputProps) => {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [thinkActive, setThinkActive] = useState(false);
  const [deepSearchActive, setDeepSearchActive] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cycle placeholder text when input is inactive
  useEffect(() => {
    if (isActive || inputValue) return;
    const interval = setInterval(() => {
      setShowPlaceholder(false);
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
        setShowPlaceholder(true);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, [isActive, inputValue]);

  // Close input when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        if (!inputValue) setIsActive(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inputValue]);

  const handleActivate = () => setIsActive(true);

  const handleSubmit = useCallback(() => {
    if (inputValue.trim() && onSubmit) {
      inputRef.current?.focus();
      onSubmit(inputValue.trim());
      setInputValue("");
    }
  }, [inputValue, onSubmit]);

  const containerVariants = {
    collapsed: {
      height: 68,
      boxShadow: darkMode ? "0 2px 8px 0 rgba(0,0,0,0.3)" : "0 2px 8px 0 rgba(0,0,0,0.08)",
      transition: { type: "spring" as const, stiffness: 120, damping: 18 },
    },
    expanded: {
      height: 128,
      boxShadow: darkMode ? "0 8px 32px 0 rgba(0,0,0,0.5)" : "0 8px 32px 0 rgba(0,0,0,0.16)",
      transition: { type: "spring" as const, stiffness: 120, damping: 18 },
    },
  };

  const placeholderContainerVariants = {
    initial: {},
    animate: { transition: { staggerChildren: 0.025 } },
    exit: { transition: { staggerChildren: 0.015, staggerDirection: -1 } },
  };

  const letterVariants = {
    initial: { opacity: 0, filter: "blur(12px)", y: 10 },
    animate: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: {
        opacity: { duration: 0.25 },
        filter: { duration: 0.4 },
        y: { type: "spring" as const, stiffness: 80, damping: 20 },
      },
    },
    exit: {
      opacity: 0,
      filter: "blur(12px)",
      y: -10,
      transition: {
        opacity: { duration: 0.2 },
        filter: { duration: 0.3 },
        y: { type: "spring" as const, stiffness: 80, damping: 20 },
      },
    },
  };

  const bgColor = darkMode ? "#1c1c1e" : "#fff";
  const textColor = darkMode ? "#fff" : "#000";
  const mutedColor = darkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
  const hoverBg = darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)";

  return (
    <motion.div
      ref={wrapperRef}
      className="w-full max-w-3xl mx-auto"
      variants={containerVariants}
      animate={isActive || inputValue ? "expanded" : "collapsed"}
      initial="collapsed"
      style={{ overflow: "hidden", borderRadius: 24, background: bgColor }}
      onClick={handleActivate}
    >
      <div className="flex flex-col items-stretch w-full h-full">
        {/* Input Row */}
        <div className="flex items-center gap-2 p-3 w-full" style={{ background: bgColor }}>
          <button
            className="p-3 rounded-full transition"
            style={{ color: mutedColor }}
            onMouseOver={(e) => e.currentTarget.style.background = hoverBg}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            title="Attach file"
            type="button"
            tabIndex={-1}
          >
            <Paperclip size={20} />
          </button>

          {/* Text Input & Placeholder */}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="flex-1 border-0 outline-0 rounded-md py-2 text-base bg-transparent w-full font-normal"
              style={{ position: "relative", zIndex: 1, color: textColor, fontSize: 16 }}
              onFocus={handleActivate}
            />
            <div className="absolute left-0 top-0 w-full h-full pointer-events-none flex items-center py-2">
              <AnimatePresence mode="wait">
                {showPlaceholder && !isActive && !inputValue && (
                  <motion.span
                    key={placeholderIndex}
                    className="absolute left-0 top-1/2 -translate-y-1/2 select-none pointer-events-none"
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      zIndex: 0,
                      color: mutedColor,
                    }}
                    variants={placeholderContainerVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    {PLACEHOLDERS[placeholderIndex].split("").map((char, i) => (
                      <motion.span
                        key={i}
                        variants={letterVariants}
                        style={{ display: "inline-block" }}
                      >
                        {char === " " ? "\u00A0" : char}
                      </motion.span>
                    ))}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          <button
            className="p-3 rounded-full transition"
            style={{ color: mutedColor }}
            onMouseOver={(e) => e.currentTarget.style.background = hoverBg}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            title="Voice input"
            type="button"
            tabIndex={-1}
            onClick={onVoiceStart}
          >
            <Mic size={20} />
          </button>

          <button
            className="flex items-center gap-1 p-3 rounded-full font-medium justify-center transition"
            style={{ 
              background: inputValue.trim() ? '#f97415' : (darkMode ? 'rgba(255,255,255,0.1)' : '#000'),
              color: '#fff',
              opacity: isLoading ? 0.5 : 1,
            }}
            title="Send"
            type="button"
            tabIndex={-1}
            onClick={handleSubmit}
            disabled={isLoading || !inputValue.trim()}
          >
            <Send size={18} />
          </button>
        </div>

        {/* Expanded Controls */}
        <motion.div
          className="w-full flex justify-start px-4 items-center text-sm"
          variants={{
            hidden: { opacity: 0, y: 20, pointerEvents: "none" as const, transition: { duration: 0.25 } },
            visible: { opacity: 1, y: 0, pointerEvents: "auto" as const, transition: { duration: 0.35, delay: 0.08 } },
          }}
          initial="hidden"
          animate={isActive || inputValue ? "visible" : "hidden"}
          style={{ marginTop: 8 }}
        >
          <div className="flex gap-3 items-center">
            {/* Think Toggle */}
            <button
              className={`flex items-center gap-1 px-4 py-2 rounded-full transition-all font-medium group ${
                thinkActive
                  ? "bg-orange-500/20 outline outline-orange-500/60 text-orange-300"
                  : darkMode ? "bg-white/10 text-white/70 hover:bg-white/20" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              title="Think"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setThinkActive((a) => !a);
              }}
            >
              <Lightbulb className="group-hover:fill-yellow-300 transition-all" size={18} />
              Think
            </button>

            {/* Deep Search Toggle */}
            <motion.button
              className={`flex items-center px-4 gap-1 py-2 rounded-full transition font-medium whitespace-nowrap overflow-hidden justify-start ${
                deepSearchActive
                  ? "bg-orange-500/20 outline outline-orange-500/60 text-orange-300"
                  : darkMode ? "bg-white/10 text-white/70 hover:bg-white/20" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              title="Deep Search"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeepSearchActive((a) => !a);
              }}
              initial={false}
              animate={{
                width: deepSearchActive ? 135 : 40,
                paddingLeft: deepSearchActive ? 12 : 11,
              }}
            >
              <div className="flex-shrink-0">
                <Globe size={18} />
              </div>
              <motion.span
                className="pb-[2px] ml-1"
                initial={false}
                animate={{ opacity: deepSearchActive ? 1 : 0 }}
              >
                Memory
              </motion.span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export { AIChatInput };
