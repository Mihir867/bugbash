"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function BadgesPage() {
  return (
    <section className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#1c1c46] to-[#302b63] flex items-center justify-center px-6 py-20">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex flex-col-reverse md:flex-row items-center gap-10 max-w-6xl mx-auto"
      >
        <div className="text-center md:text-left max-w-xl">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl md:text-5xl font-extrabold text-white leading-tight"
          >
            GitHub Contributor <span className="text-[#4646fc]">Badge</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-gray-300 mt-4 text-lg"
          >
            Earn a verified, BreachX badge for your secure open-source contributions.
            It&apos;s your identity — on-chain.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-6"
          >
            <Button
              className="bg-[#4646fc] hover:bg-[#3737e6] text-white px-6 py-3 text-md font-medium rounded-full shadow-md transition duration-300"
              asChild
            >
              <a href="/dashboard">
                Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </motion.div>
          <p className="mt-4 text-sm text-[#ababff] uppercase tracking-wide">
            Feature Coming Soon...
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="max-w-md w-full"
        >
          <Image
            src="/github.webp"
            alt="Badge Coming Soon"
            width={500}
            height={500}
            className="w-full h-auto"
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
