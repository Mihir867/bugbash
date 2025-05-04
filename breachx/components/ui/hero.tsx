"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"

export default function HeroSection() {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [isVisible, setIsVisible] = useState(true) // Always show the string

  // Set initial mouse position to a good default position and update with smoother tracking
  useEffect(() => {
    // Set a good default position to start - uppaer right quarter for good aesthetics
    const defaultX = window.innerWidth * 0.75
    const defaultY = window.innerHeight * 0.25
    
    let currentX = defaultX
    let currentY = defaultY
    let raf: number

    // Initialize mouse position with default
    setMousePosition({ x: defaultX, y: defaultY })

    const smoothMouseMove = () => {
      // Smooth interpolation for mouse movement
      currentX += (mousePosition.x - currentX) * 0.15
      currentY += (mousePosition.y - currentY) * 0.15
      
      setMousePosition({ x: currentX, y: currentY })
      raf = requestAnimationFrame(smoothMouseMove)
    }

    const handleMouseMove = (e: MouseEvent) => {
      mousePosition.x = e.clientX
      mousePosition.y = e.clientY
    }

    // Start smooth animation
    raf = requestAnimationFrame(smoothMouseMove)
    window.addEventListener("mousemove", handleMouseMove)
    
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  // Update button position
  useEffect(() => {
    const updateButtonPosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect()
        setButtonPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
        })
      }
    }

    updateButtonPosition()
    window.addEventListener("resize", updateButtonPosition)
    window.addEventListener("scroll", updateButtonPosition)

    // Update position regularly to ensure accuracy
    const interval = setInterval(updateButtonPosition, 100)

    return () => {
      window.removeEventListener("resize", updateButtonPosition)
      window.removeEventListener("scroll", updateButtonPosition)
      clearInterval(interval)
    }
  }, [])

  // Enhanced string effect
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size to window size with higher resolution for retina displays
    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.scale(dpr, dpr)
    }

    updateCanvasSize()
    window.addEventListener("resize", updateCanvasSize)

    // Animation variables for effects
    let particleTimer = 0
    const particles: Array<{
      x: number;
      y: number;
      size: number;
      speed: number;
      life: number;
      maxLife: number;
      color: string;
    }> = []

    // Animation loop with enhanced visuals
    let animationFrameId: number

    const render = (timestamp: number) => {
      ctx.clearRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1))
      
      // Draw string only if we have valid positions
      if (mousePosition.x && buttonPosition.x) {
        const buttonCenterX = buttonPosition.x
        const buttonCenterY = buttonPosition.y

        // Calculate distance for effects
        const dx = mousePosition.x - buttonCenterX
        const dy = mousePosition.y - buttonCenterY
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        // Make the string visible across the entire section
        const maxDistance = Math.max(window.innerWidth, window.innerHeight) * 1.5
        
        // Improved string opacity for better visibility
        const baseOpacity = isHovering ? 0.9 : 0.7
        let opacity = isVisible ? baseOpacity : 0
        opacity *= Math.max(0.3, 1 - distance / maxDistance) // Minimum opacity of 0.3

        // Create gradient for the string
        const gradient = ctx.createLinearGradient(
          mousePosition.x, 
          mousePosition.y, 
          buttonCenterX, 
          buttonCenterY
        )
        
        // Vibrant color scheme
        if (isHovering) {
          gradient.addColorStop(0, "rgba(110, 231, 255, " + opacity + ")")
          gradient.addColorStop(0.5, "rgba(166, 130, 255, " + opacity + ")")
          gradient.addColorStop(1, "rgba(79, 70, 229, " + opacity + ")")
        } else {
          gradient.addColorStop(0, "rgba(255, 255, 255, " + opacity + ")")
          gradient.addColorStop(0.5, "rgba(147, 197, 253, " + opacity + ")")
          gradient.addColorStop(1, "rgba(99, 102, 241, " + opacity + ")")
        }

        // Draw primary string with gradient
        ctx.beginPath()
        ctx.moveTo(mousePosition.x, mousePosition.y)
        ctx.lineTo(buttonCenterX, buttonCenterY)
        ctx.strokeStyle = gradient
        ctx.lineWidth = isHovering ? 3 : 2
        ctx.stroke()

        // Draw outer glow effect
        ctx.beginPath()
        ctx.moveTo(mousePosition.x, mousePosition.y)
        ctx.lineTo(buttonCenterX, buttonCenterY)
        ctx.strokeStyle = isHovering 
          ? `rgba(147, 197, 253, ${opacity * 0.6})` 
          : `rgba(147, 197, 253, ${opacity * 0.4})`
        ctx.lineWidth = isHovering ? 7 : 5
        ctx.stroke()

        // Add pulsing effect
        const pulseSize = Math.sin(timestamp * 0.003) * 2 + 4
        
        // Draw pulsing circles at endpoints
        ctx.beginPath()
        ctx.arc(buttonCenterX, buttonCenterY, pulseSize, 0, Math.PI * 2)
        ctx.fillStyle = isHovering 
          ? `rgba(79, 70, 229, ${opacity * 0.8})` 
          : `rgba(147, 197, 253, ${opacity * 0.6})`
        ctx.fill()

        ctx.beginPath()
        ctx.arc(mousePosition.x, mousePosition.y, pulseSize - 1, 0, Math.PI * 2)
        ctx.fillStyle = isHovering 
          ? `rgba(110, 231, 255, ${opacity * 0.8})` 
          : `rgba(255, 255, 255, ${opacity * 0.6})`
        ctx.fill()

        // Add particles when hovering
        if (isHovering) {
          particleTimer++
          
          // Create new particles along the string
          if (particleTimer % 3 === 0) {
            // Calculate a position along the line
            const ratio = Math.random()
            const particleX = mousePosition.x * (1 - ratio) + buttonCenterX * ratio
            const particleY = mousePosition.y * (1 - ratio) + buttonCenterY * ratio
            
            particles.push({
              x: particleX,
              y: particleY,
              size: Math.random() * 3 + 1,
              speed: Math.random() * 1 + 0.5,
              life: 0,
              maxLife: Math.random() * 30 + 10,
              color: Math.random() > 0.5 ? "rgba(147, 197, 253, 0.8)" : "rgba(79, 70, 229, 0.8)"
            })
          }
        }

        // Update and draw particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]
          p.life++
          
          // Remove dead particles
          if (p.life >= p.maxLife) {
            particles.splice(i, 1)
            continue
          }
          
          // Calculate particle opacity based on life
          const particleOpacity = 1 - p.life / p.maxLife
          
          // Draw particle
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fillStyle = p.color.replace("0.8", particleOpacity.toString())
          ctx.fill()
          
          // Move particle in direction of string with slight randomness
          const angle = Math.atan2(buttonCenterY - mousePosition.y, buttonCenterX - mousePosition.x)
          p.x += Math.cos(angle + (Math.random() - 0.5) * 0.5) * p.speed
          p.y += Math.sin(angle + (Math.random() - 0.5) * 0.5) * p.speed
        }
      }

      animationFrameId = window.requestAnimationFrame(render)
    }

    animationFrameId = window.requestAnimationFrame(render)

    return () => {
      window.removeEventListener("resize", updateCanvasSize)
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [mousePosition, buttonPosition, isHovering, isVisible])

  return (
    <div className="relative w-full h-screen flex items-center justify-center overflow-hidden bg-black">
  {/* Starry + Gradient Background */}
  <div className="absolute inset-0 z-0">
    {/* Starry pattern */}
    <div
      className="absolute inset-0 bg-[url('/galaxy-background-decorative-seamless-pattern-repeating-background-tileable-wallpaper-print_153302-476.avif')] bg-repeat opacity-20"
      style={{ backgroundSize: '200px 200px' }}
    />
    
    {/* Gradient overlay */}
    <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/20 via-gray-900 to-black" />
  </div>

  {/* Canvas for string effect */}
  <canvas 
    ref={canvasRef} 
    className="absolute inset-0 z-10 pointer-events-none" 
    style={{ touchAction: "none" }}
  />

  {/* Hero content */}
  <div className="relative z-20 text-center">
    <motion.h1
      className="text-5xl md:text-7xl font-bold text-white mb-6"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
    >
      Secure Your Digital Presence
    </motion.h1>

    <motion.p
      className="text-xl md:text-2xl text-gray-300 mb-12 max-w-2xl mx-auto"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
    >
      Protect your repositories and code with our advanced security scanning and vulnerability detection
    </motion.p>

    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.4 }}
    >
      <Button
        ref={buttonRef}
        className="font-medium cursor-pointer py-3 px-8 bg-black rounded-lg text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        Get Started Now
      </Button>
    </motion.div>
  </div>
</div>

  )
}