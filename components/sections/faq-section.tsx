"use client";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
    {
        question: "Is this a chatbot?",
        answer: "No. This is a full-stack intelligence system — from core model to behavioral layer. SoulPrint isn't a chatbot or assistant. It's an identity engine that powers real presence.",
    },
    {
        question: "Do you use OpenAI or Anthropic?",
        answer: "No. We’ve built our own engine from the ground up — tuned for emotional cadence, context persistence, and long-range memory. This isn’t rented intelligence. This is ours.",
    },
    {
        question: "Can I bring SoulPrint to other models?",
        answer: "Not yet — and that’s by design. We're proving that model quality means nothing without identity fidelity. Once we set the standard, then we’ll unlock SoulPrint for external engines.",
    },
    {
        question: "Is my identity safe?",
        answer: "Yes. Everything runs under SoulPrint’s privacy architecture: No behavioral tracking, no data harvesting, no cloud surveillance. Optional encrypted backups, never required. You own your data. We own the engine.",
    },
    {
        question: "Does this mean SoulPrint is the model?",
        answer: "Not quite. Think of it like this: The model is muscle. SoulPrint is soul. The LLM handles inference. SoulPrint handles identity, rhythm, behavior, memory, and tone.",
    },
    {
        question: "Is this open source?",
        answer: "We’ll open select modules — especially around behavioral customization and local deployment. But the core? Locked down. Not to gatekeep — to protect the fidelity of what we’re building.",
    },
    {
        question: "What makes this different from every other AI product?",
        answer: "Other products rent models and wrap them in prompts. We own the model, and we’re building the emotional infrastructure that makes AI feel alive. This is presence over prompts. Continuity over cleverness.",
    },
];

export function FaqSection() {
    return (
        <section id="faq" className="w-full bg-[#0A0A0A] py-24 text-white">
            <div className="mx-auto max-w-3xl px-6 md:px-12">
                <h2 className="mb-12 font-koulen text-4xl uppercase leading-none md:text-5xl text-center text-white">
                    Frequently Asked Questions
                </h2>

                <Accordion type="single" collapsible className="w-full">
                    {faqs.map((faq, index) => (
                        <AccordionItem key={index} value={`item-${index}`} className="border-b border-white/10">
                            <AccordionTrigger className="font-geist text-lg font-medium text-white hover:text-[#EA580C] hover:no-underline text-left">
                                {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="font-geist text-base text-neutral-400 leading-relaxed">
                                {faq.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </section>
    );
}
