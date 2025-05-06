/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import Link from "next/link"
import { signIn, signOut, useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import { motion, useScroll, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { Menu, X } from "lucide-react"
import { Button } from "./button"

export default function Header() {
  const { data: session, status } = useSession()
  const loading = status === "loading"
  const [isOpen, setIsOpen] = useState(false)

  const { scrollY } = useScroll()
  const [hidden, setHidden] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // Close mobile menu when screen size changes
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(false)
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Handle scroll effects
  

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }

    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  return (
    <>
      <motion.div
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
          scrolled ? "backdrop-blur-md bg-black/40 border-b border-gray-800/30" : "backdrop-blur-sm bg-black/20"
        }`}
        initial={{ y: 0 }}
        animate={{ y: hidden ? "-100%" : "0%" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        style={{
          boxShadow: scrolled ? "0 4px 30px rgba(0, 0, 0, 0.3)" : "none",
        }}
      >
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="py-4">
            <div className="container mx-auto flex justify-between items-center">
              <Link href="/" className="text-xl font-bold text-white z-10">
                Breach X
              </Link>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex gap-6 items-center">
                

                {session && (
                  <>
                    <Link href="/dashboard" className="text-gray-300 hover:text-white transition-colors">
                      Dashboard
                    </Link>
                    
                  </>
                )}

                {!loading && !session && (
                  <Button
                    onClick={() => signIn("github")}
                    className="bg-blue-600/80 cursor-pointer hover:bg-blue-700/90 text-white px-4 py-2 rounded-md backdrop-blur-sm transition-all"
                  >
                    Sign In with GitHub
                  </Button>
                )}

                {session && (
                  <div className="flex items-center gap-3 ml-2">
                    {session.user?.image && (
                      <div className="ring-2 ring-white/20 rounded-full">
                        <Image
                          src={session.user.image || "/placeholder.svg"}
                          alt={session.user.name || "User"}
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                      </div>
                    )}
                    <span className="text-gray-300">{session.user?.name}</span>
                    {/* <Button
                      onClick={() => signOut()}
                      className="bg-red-600/70 cursor-pointer hover:bg-red-700/80 text-white px-3 py-1 rounded-md text-sm transition-all"
                    >
                      Sign Out
                    </Button> */}
                  </div>
                )}
              </nav>

              {/* Mobile Menu Button */}
              <Button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden text-white z-10"
                aria-label={isOpen ? "Close menu" : "Open menu"}
              >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
              </Button>
            </div>
          </header>
        </div>
      </motion.div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-lg z-40"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-xs bg-gray-900/90 backdrop-blur-md border-l border-gray-800/30 p-6 pt-20 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-6">
                

                {session && (
                  <>
                    <Link
                      href="/dashboard"
                      className="text-white text-lg font-medium hover:text-gray-300 transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      Dashboard
                    </Link>
                    
                  </>
                )}

                {!loading && !session && (
                  <Button
                    onClick={() => {
                      setIsOpen(false)
                      signIn("github")
                    }}
                    className="bg-blue-600/80 cursor-pointer hover:bg-blue-700 text-white px-4 py-3 rounded-md text-lg font-medium w-full"
                  >
                    Sign In with GitHub
                  </Button>
                )}

                {session && (
                  <div className="mt-4 pt-4 border-t border-gray-800/50">
                    <div className="flex items-center gap-3 mb-4">
                      {session.user?.image && (
                        <div className="ring-2 ring-white/20 rounded-full">
                          <Image
                            src={session.user.image || "/placeholder.svg"}
                            alt={session.user.name || "User"}
                            width={40}
                            height={40}
                            className="rounded-full"
                          />
                        </div>
                      )}
                      <span className="text-white font-medium">{session.user?.name}</span>
                    </div>
                    <Button
                      onClick={() => {
                        setIsOpen(false)
                        signOut()
                      }}
                      className="bg-red-600/70 cursor-pointer hover:bg-red-700 text-white px-4 py-3 rounded-md text-lg font-medium w-full"
                    >
                      Sign Out
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
