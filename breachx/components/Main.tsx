"use client";

import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ShieldCheck,
  Github,
  BarChart3,
  Sparkles,
  Users,
  Landmark,
} from "lucide-react";
import { motion } from "framer-motion";

export default function Main() {
  return (
    <main className="w-full bg-black text-white">
      {/* Section 1: Why Security Matters */}
      <section className="relative py-24 px-4 sm:px-10 md:px-20 bg-gradient-to-b from-black via-purple-900 to-black overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-5xl mx-auto text-center"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Why Secure Code Deserves{" "}
            <span className="text-purple-400">Recognition</span>
          </h2>
          <p className="text-lg text-purple-100/90 mb-8">
            Security should be rewarded. BreachX gives developers the credit
            they deserve for writing safe, robust, and audit-ready code.
          </p>
          <Button className="bg-white text-black px-6 hover:bg-white/90">
            Learn More <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </motion.div>
      </section>

      {/* Section 2: Badge Overview */}
      <section className="py-28 px-6 md:px-20 bg-black">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto"
        >
          <div>
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              🛡 Verified Secure Contributor
            </h3>
            <p className="text-purple-100/90 mb-6">
              Developers who maintain high-security standards receive a dynamic
              badge they can embed in their GitHub profile or portfolio. Stand
              out with verified credibility.
            </p>
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 px-5 text-white">
              Explore Badges <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="bg-purple-900/20 rounded-3xl p-10 border border-purple-400/20 shadow-xl backdrop-blur-xl">
            <ShieldCheck className="w-20 h-20 text-purple-400 mb-4" />
            <h4 className="text-xl font-semibold mb-2">
              Security Trust Score: 97%
            </h4>
            <p className="text-purple-100 text-sm">
              Badge issued based on security checks, test coverage, and critical
              vulnerabilities.
            </p>
          </div>
        </motion.div>
      </section>

      {/* Section 3: Dashboard Preview */}
      <section className="py-28 bg-gradient-to-b from-purple-950 via-black to-black px-6 md:px-20">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-6xl mx-auto text-center"
        >
          <h3 className="text-3xl md:text-5xl font-bold mb-6">
            📊 Personalized Vulnerability Reports
          </h3>
          <p className="text-lg text-purple-100/90 mb-10">
            View in-depth security metrics for all your repositories. Track,
            fix, and grow.
          </p>
          <Button className="bg-white text-black px-6 hover:bg-white/90">
            Go to Dashboard <BarChart3 className="ml-2 h-4 w-4" />
          </Button>
        </motion.div>
      </section>

      {/* Section 4: GitHub Integration */}
      <section className="py-28 px-6 md:px-20 bg-black">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center"
        >
          <div className="bg-purple-900/30 border border-purple-400/20 rounded-2xl p-8 shadow-xl backdrop-blur-xl">
            <Github className="w-16 h-16 text-white mb-4" />
            <h4 className="text-xl font-semibold mb-3">Connect Your GitHub</h4>
            <p className="text-sm text-purple-100">
              Sync your repositories securely and instantly start scanning them
              with our AI-powered engine.
            </p>
          </div>
          <div>
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              🔗 Seamless GitHub Integration
            </h3>
            <p className="text-purple-100/90 mb-6">
              BreachX connects directly with your GitHub account to audit public
              repos. Secure your codebase in just a few clicks.
            </p>
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 px-5 text-white">
              Connect GitHub <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Section 5: AI Security Engine */}
      <section className="py-28 px-6 md:px-20 bg-gradient-to-b from-black via-purple-900 to-black">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center"
        >
          <div>
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              ✨ AI-Powered Security Scans
            </h3>
            <p className="text-purple-100/90 mb-6">
              Let BreachX AI automatically detect insecure patterns, outdated
              libraries, and vulnerable logic in real time.
            </p>
            <Button className="bg-white text-black px-6 hover:bg-white/90">
              Start Scanning <Sparkles className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="bg-purple-900/20 rounded-3xl p-10 border border-purple-400/20 shadow-xl backdrop-blur-xl">
            <Sparkles className="w-20 h-20 text-purple-400 mb-4" />
            <h4 className="text-xl font-semibold mb-2">AI Engine: v3.2</h4>
            <p className="text-purple-100 text-sm">
              Scans millions of lines of code weekly. Supports JavaScript,
              Python, Solidity, Rust & more.
            </p>
          </div>
        </motion.div>
      </section>

      {/* Section 6: Community & Rewards */}
      <section className="py-28 px-6 md:px-20 bg-black">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-6xl mx-auto text-center"
        >
          <Users className="mx-auto w-16 h-16 text-purple-400 mb-6" />
          <h3 className="text-3xl md:text-5xl font-bold mb-6">
            🏆 Earn Rewards. Build Reputation.
          </h3>
          <p className="text-lg text-purple-100/90 mb-8">
            Join the community of secure developers. Climb the leaderboard, earn
            monthly rewards, and get recognized for writing safe code.
          </p>
          <Button className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 text-white">
            Join Community <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </motion.div>
      </section>

      {/* Section 7: Enterprise Trust Layer */}
      <section className="py-28 px-6 md:px-20 bg-gradient-to-b from-black via-purple-950 to-black">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center"
        >
          <div>
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              🏛 Enterprise-Grade Trust Layer
            </h3>
            <p className="text-purple-100/90 mb-6">
              Offer your clients peace of mind. BreachX certifies code quality
              and compliance, making procurement and onboarding easier for
              enterprises.
            </p>
          </div>
          <div className="bg-purple-900/20 rounded-3xl p-10 border border-purple-400/20 shadow-xl backdrop-blur-xl">
            <Landmark className="w-20 h-20 text-purple-400 mb-4" />
            <h4 className="text-xl font-semibold mb-2">
              Trusted by Enterprises
            </h4>
            <p className="text-purple-100 text-sm">
              BreachX helps teams prove security rigor and compliance to
              stakeholders and clients.
            </p>
          </div>
        </motion.div>
      </section>

      {/* Footer Section */}
      <footer className="bg-black py-20 px-6 md:px-20 border-t border-purple-800/20">
        <div className="max-w-6xl mx-auto text-center">
          <h4 className="text-2xl font-semibold text-purple-100 mb-4">
            Ready to Make Your Code Bulletproof?
          </h4>
          <p className="text-purple-100/80 mb-8">
            Join thousands of developers securing their code with BreachX.
          </p>
          <Button className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6">
            Get Started Now <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="text-sm text-purple-100/40 mt-8">
            © {new Date().getFullYear()} BreachX. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
