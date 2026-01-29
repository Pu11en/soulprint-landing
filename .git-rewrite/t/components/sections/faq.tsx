"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { motion } from "framer-motion"

const faqs = [
    {
        question: "What is SoulPrint?",
        answer: "SoulPrint is an AI-powered platform that analyzes your communication patterns to create a unique cognitive signature. It maps your cognitive rhythm, tone signature, and identity layers to provide deep insights into how you think and communicate."
    },
    {
        question: "How does the analysis work?",
        answer: "Our advanced AI models analyze your text input to identify patterns in your communication style, emotional range, cognitive tempo, and linguistic preferences. The system processes this data in real-time to generate your unique SoulPrint vector."
    },
    {
        question: "Is my data secure and private?",
        answer: "Absolutely. We use end-to-end encryption for all data transmission and storage. Your SoulPrint data is stored securely in your private vault, and you maintain full control over who can access it. We never share your personal data with third parties."
    },
    {
        question: "How accurate is the SoulPrint analysis?",
        answer: "Our AI models have been trained on millions of communication samples and achieve a 95% accuracy rate in pattern recognition. The more you use SoulPrint, the more refined and accurate your cognitive signature becomes."
    },
    {
        question: "Can I use SoulPrint for team collaboration?",
        answer: "Yes! Our Enterprise plan includes team collaboration features, allowing organizations to understand team dynamics, improve communication, and optimize workflows based on cognitive compatibility insights."
    },
    {
        question: "What makes SoulPrint different from personality tests?",
        answer: "Unlike static personality tests, SoulPrint analyzes your actual communication patterns in real-time. It captures the nuances of how you express yourself, not just how you answer predetermined questions. Your SoulPrint evolves as you do."
    }
]

export function FAQ() {
    return (
        <section id="faq" className="py-20 md:py-32">
            <div className="container px-4">
                <motion.div
                    className="text-center mb-16"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                >
                    <h2 className="text-4xl md:text-5xl font-bold mb-4">
                        Frequently Asked Questions
                    </h2>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Everything you need to know about SoulPrint
                    </p>
                </motion.div>

                <motion.div
                    className="max-w-3xl mx-auto"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <Accordion type="single" collapsible className="w-full">
                        {faqs.map((faq, index) => (
                            <AccordionItem key={index} value={`item-${index}`}>
                                <AccordionTrigger className="text-lg font-semibold">
                                    {faq.question}
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    {faq.answer}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </motion.div>
            </div>
        </section>
    )
}
