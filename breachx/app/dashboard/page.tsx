/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  Search,
  Grid3X3,
  List,
  ChevronDown,
  Cloud,
  Plus,
  Star,
  GitFork,
  ArrowRight,
  X,
  Clock,
  Github,
  Loader2,
  Filter,
  SlidersHorizontal,
  Sparkles,
  Check,
  FileCode,
  Code,
  Database,
  Terminal,
  Key,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { motion, AnimatePresence } from "framer-motion"
import { Progress } from "@/components/ui/progress"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"


export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [repositories, setRepositories] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRepo, setSelectedRepo] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState("grid")
  const [searchTerm, setSearchTerm] = useState("")
  const [transitionState, setTransitionState] = useState("browsing") // browsing, configuring, redirecting
  const [savingRepo, setSavingRepo] = useState(false)
  const [hasDocker, setHasDocker] = useState(false)
  const [dockerConfig, setDockerConfig] = useState("")
  const [rootDirectory, setRootDirectory] = useState("")
  const [buildCommand, setBuildCommand] = useState("")
  const [runCommand, setRunCommand] = useState("")
  const [hasEnv, setHasEnv] = useState(false)
  const [envVars, setEnvVars] = useState([{ key: "", value: "" }])
  const [progress, setProgress] = useState(0)
  const [sortOption, setSortOption] = useState("activity")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/sign-in")
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchUserRepositories()
    }
  }, [session])

  // Progress bar animation for redirecting state
  useEffect(() => {
    if (transitionState === "redirecting") {
      const timer = setInterval(() => {
        setProgress((oldProgress) => {
          const newProgress = Math.min(oldProgress + 2, 100)
          if (newProgress === 100) {
            clearInterval(timer)
            // Redirect after progress reaches 100%
            setTimeout(() => {
              if (selectedRepo) {
                router.push(`/repository/${selectedRepo.id}`)
              }
            }, 500)
          }
          return newProgress
        })
      }, 50)
      return () => clearInterval(timer)
    }
  }, [transitionState, router, selectedRepo])

  const fetchUserRepositories = async () => {
    try {
      // Simulate loading for demo purposes
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const response = await fetch("/api/saveRepo")
     
        const data = await response.json()
        setRepositories(data)
     
       
      
    } catch (error) {
      console.error("Error fetching repositories:", error)
     
    } finally {
      setLoading(false)
    }
  }

 

  const handleSelectRepo = (repo:any) => {
    setSelectedRepo(repo)

    // Immediately save the repo in the background
    saveRepoToDatabase(repo)

    // Quick transition to configuration form
    setTimeout(() => {
      setTransitionState("configuring")
    }, 300)
  }

  const saveRepoToDatabase = async (repo:any) => {
    setSavingRepo(true)
    try {
      const response = await fetch("/api/saveRepo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repoId: repo.id.toString(),
          name: repo.name,
          description: repo.description || "",
          url: repo.html_url || repo.url || "",
        }),
      })

      if (!response.ok) {
        console.error("Failed to save repository")
      }
    } catch (error) {
      console.error("Error saving repository:", error)
    } finally {
      setSavingRepo(false)
    }
  }

  const handleConfigSubmit = async (e:any) => {
    e?.preventDefault()
    setTransitionState("redirecting")
    setProgress(0)

    // Save the configuration
    try {
      if(selectedRepo) {
      await fetch(`/api/repoConfig/${selectedRepo.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hasDocker,
          dockerConfig: hasDocker ? dockerConfig : null,
          rootDirectory: !hasDocker ? rootDirectory : null,
          buildCommand: !hasDocker ? buildCommand : null,
          runCommand: !hasDocker ? runCommand : null,
          env: hasEnv ? envVars.filter((v) => v.key.trim() !== "") : [],
        }),
      })
    }
    } catch (error) {
      console.error("Error saving configuration:", error)
    }
  }

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: "", value: "" }])
  }

  const updateEnvVar = ({index, field, value}:any) => {
    const updatedVars = [...envVars]
    updatedVars[index][field] = value
    setEnvVars(updatedVars)
  }

  const removeEnvVar = (index:any) => {
    const updatedVars = [...envVars]
    updatedVars.splice(index, 1)
    setEnvVars(updatedVars)
  }

  const getLanguageColor = (language:any) => {
    const colors = {
      JavaScript: "bg-yellow-400",
      TypeScript: "bg-blue-500",
      Python: "bg-green-500",
      Java: "bg-orange-500",
      Ruby: "bg-red-500",
      Go: "bg-cyan-500",
      PHP: "bg-purple-500",
      HTML: "bg-red-600",
      CSS: "bg-pink-500",
      "C#": "bg-green-600",
      "C++": "bg-blue-700",
    }
    return colors[language] || "bg-gray-500"
  }

  const filteredRepositories = repositories.filter(
    (repo:any) =>
      repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  // Sort repositories based on selected option
  const sortedRepositories = [...filteredRepositories].sort((a, b) => {
    switch (sortOption) {
      case "stars":
        return (b.stargazers_count || 0) - (a.stargazers_count || 0)
      case "forks":
        return (b.forks_count || 0) - (a.forks_count || 0)
      case "name":
        return a.name.localeCompare(b.name)
      case "activity":
      default:
        return new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
    }
  })


 

  // Form sections completion tracking
  const [completedSections, setCompletedSections] = useState<string[]>([])

  // Form sections open/closed state
  const [openSections, setOpenSections] = useState<string[]>(["docker"])

  const toggleSection = (section: string) => {
    setOpenSections((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]))
  }

  
  const markSectionComplete = (section: string) => {
    if (!completedSections.includes(section)) {
      setCompletedSections([...completedSections, section])
    }
  }



  // Check if Docker section is valid
  const isDockerSectionValid = () => {
    if (hasDocker) {
      return dockerConfig.trim().length > 0
    } else {
      return rootDirectory.trim().length > 0 && buildCommand.trim().length > 0 && runCommand.trim().length > 0
    }
  }

  // Check if Environment Variables section is valid
  const isEnvSectionValid = () => {
    if (!hasEnv) return true
    return envVars.length > 0 && envVars.every((v) => v.key.trim() && v.value.trim())
  }

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-full border-t-2 border-blue-500 animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-r-2 border-purple-500 animate-spin animate-reverse"></div>
          <div className="absolute inset-4 rounded-full border-b-2 border-teal-500 animate-spin animate-delay-500"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-blue-400 animate-pulse" />
          </div>
        </div>
        <h3 className="mt-8 text-xl font-medium text-white animate-pulse">Loading your workspace</h3>
        <p className="mt-2 text-gray-400">Preparing your development environment...</p>
      </div>
    )
  }

  if (!session) {
    return null // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white pt-20">
      <AnimatePresence mode="wait">
        {transitionState === "browsing" && (
          <motion.div
            key="browsing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center p-6"
          >
            {/* Header with user info */}
            <div className="w-full max-w-7xl flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
                    {session?.user?.name?.charAt(0) || "U"}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-black"></div>
                </div>
                <div>
                  <h2 className="text-lg font-medium text-white">Welcome back, {session?.user?.name || "User"}</h2>
                  <p className="text-sm text-gray-400">Let deploy something amazing today</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
               
              </div>
            </div>

            {/* Search and filters */}
            <div className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div className="relative w-full md:max-w-xl">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search repositories..."
                  className="pl-10 pr-16 py-2 bg-gray-900/50 border-gray-800 text-gray-300 w-full rounded-lg focus:ring-2 focus:ring-blue-500/50 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1 text-xs text-gray-500 bg-gray-800/80 px-2 py-1 rounded">
                  <span>⌘</span>
                  <span>K</span>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="bg-gray-900/50 border-gray-800 text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Sort: {sortOption.charAt(0).toUpperCase() + sortOption.slice(1)}
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-gray-900 border-gray-800 text-gray-300">
                    <DropdownMenuItem
                      onClick={() => setSortOption("activity")}
                      className="hover:bg-gray-800 hover:text-white cursor-pointer"
                    >
                      <Clock className="h-4 w-4 mr-2" /> Activity
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setSortOption("stars")}
                      className="hover:bg-gray-800 hover:text-white cursor-pointer"
                    >
                      <Star className="h-4 w-4 mr-2" /> Stars
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setSortOption("forks")}
                      className="hover:bg-gray-800 hover:text-white cursor-pointer"
                    >
                      <GitFork className="h-4 w-4 mr-2" /> Forks
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setSortOption("name")}
                      className="hover:bg-gray-800 hover:text-white cursor-pointer"
                    >
                      <Filter className="h-4 w-4 mr-2" /> Name
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex border border-gray-800 rounded-lg overflow-hidden">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          className={`px-3 py-2 h-10 ${
                            viewMode === "grid"
                              ? "bg-gray-800 text-white"
                              : "bg-transparent text-gray-500 hover:text-white hover:bg-gray-800/50"
                          }`}
                          onClick={() => setViewMode("grid")}
                        >
                          <Grid3X3 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="bg-gray-900 text-white border-gray-800">
                        Grid view
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          className={`px-3 py-2 h-10 ${
                            viewMode === "list"
                              ? "bg-gray-800 text-white"
                              : "bg-transparent text-gray-500 hover:text-white hover:bg-gray-800/50"
                          }`}
                          onClick={() => setViewMode("list")}
                        >
                          <List className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="bg-gray-900 text-white border-gray-800">
                        List view
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>

            {/* Repository Cards */}
            <div
              className={`w-full max-w-7xl min-h-[800px] ${
                viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-4"
              }`}
            >
              {sortedRepositories.length === 0 ? (
                <div className="col-span-full text-center py-12 bg-gray-900/30 rounded-xl border border-gray-800 backdrop-blur-sm">
                  <Cloud className="h-16 w-16 text-gray-700 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-300 mb-2">No repositories found</h3>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto">
                    {searchTerm
                      ? `No results for "${searchTerm}". Try a different search term.`
                      : "Create a new repository or connect an existing one to get started."}
                  </p>
                  <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 flex items-center gap-2 mx-auto">
                    <Plus className="h-4 w-4" />
                    Create Repository
                  </Button>
                </div>
              ) : (
                sortedRepositories.map((repo:any) => (
                  <motion.div
                    key={repo.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      className={`relative overflow-hidden transition-all duration-300 border rounded-xl shadow-lg
                        ${viewMode === "list" ? "flex justify-between text-left items-center w-full" : ""}
                        ${
                          selectedRepo && selectedRepo.id === repo.id
                            ? "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] ring-2 ring-blue-400/30"
                            : "border-gray-800/50 hover:border-blue-500/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                        }
                        bg-gray-900/40 backdrop-blur-sm`}
                    >
                      {/* Gradient overlay at the top */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

                      <CardContent className={`p-6 ${viewMode === "list" ? "flex-1" : ""}`}>
                        <div className="flex flex-col justify-center items-start w-full h-full">
                          <div className="flex justify-between w-full mb-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-white mb-1 flex items-center">
                                {repo.name}
                                {repo.private && (
                                  <Badge className="ml-2 bg-gray-800 text-gray-300 text-xs">Private</Badge>
                                )}
                              </h3>
                             
                            </div>
                            {viewMode === "list" && (
                              <Button
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0"
                                onClick={() => handleSelectRepo(repo)}
                              >
                                Select
                              </Button>
                            )}
                          </div>

                          <div className="mt-auto flex flex-wrap items-center text-xs text-gray-400 space-x-4">
                            {repo.language && (
                              <div className="flex items-center">
                                <div className={`w-2 h-2 rounded-full mr-1 ${getLanguageColor(repo.language)}`}></div>
                                <span>{repo.language}</span>
                              </div>
                            )}
                            {repo.stargazers_count !== undefined && (
                              <div className="flex items-center">
                                <Star className="h-3 w-3 mr-1" />
                                <span>{repo.stargazers_count}</span>
                              </div>
                            )}
                            {repo.forks_count !== undefined && (
                              <div className="flex items-center">
                                <GitFork className="h-3 w-3 mr-1" />
                                <span>{repo.forks_count}</span>
                              </div>
                            )}
                            {repo.updated_at && (
                              <div className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                <span>
                                  {new Date(repo.updated_at).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>

                      {viewMode !== "list" && (
                        <CardFooter className="p-0 border-t border-gray-800/50">
                          <Button
                            className="w-full rounded-none py-3 bg-gray-800/50 hover:bg-gradient-to-r from-blue-600 to-indigo-600 text-gray-300 hover:text-white transition-all duration-300"
                            onClick={() => handleSelectRepo(repo)}
                          >
                            Select Repository
                          </Button>
                        </CardFooter>
                      )}
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {transitionState === "configuring" && (
          <motion.div
            key="configuring"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center p-6"
          >
            <div className="w-full max-w-2xl bg-gradient-to-br from-gray-900/80 to-gray-950/80 border border-gray-800/80 rounded-xl p-8 shadow-xl backdrop-blur-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    Configure Deployment
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">Set up your project for deployment</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 text-sm font-medium">Step 1 of 2</span>
                  <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="w-1/2 h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"></div>
                  </div>
                </div>
              </div>

              {selectedRepo && (
                <div className="mb-8">
                  <Card className="border-blue-500/30 bg-gradient-to-br from-gray-900/60 to-gray-950/60 p-4 rounded-xl overflow-hidden relative">
                    {/* Pulsing glow effect */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl opacity-20 blur-xl animate-pulse"></div>

                    <div className="relative flex items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Github className="h-5 w-5 text-gray-400" />
                          <h3 className="text-lg font-semibold text-white flex items-center">
                            {selectedRepo.name}
                            {selectedRepo.private && (
                              <Badge className="ml-2 bg-gray-800 text-gray-300 text-xs">Private</Badge>
                            )}
                          </h3>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-2">
                          {selectedRepo.language && (
                            <div className="flex items-center">
                              <div
                                className={`w-2 h-2 rounded-full mr-1 ${getLanguageColor(selectedRepo.language)}`}
                              ></div>
                              <span>{selectedRepo.language}</span>
                            </div>
                          )}
                          {selectedRepo.stargazers_count !== undefined && (
                            <div className="flex items-center">
                              <Star className="h-3 w-3 mr-1" />
                              <span>{selectedRepo.stargazers_count}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

<form onSubmit={handleConfigSubmit} className="space-y-6">
        {/* Docker Configuration */}
        <Collapsible
          open={openSections.includes("docker")}
          onOpenChange={() => toggleSection("docker")}
          className={cn(
            "rounded-lg border transition-all duration-200",
            isDockerSectionValid() && completedSections.includes("docker")
              ? "border-green-500/30 bg-green-500/5"
              : "border-gray-800/50 bg-gray-900/30",
          )}
        >
          <div className="p-5">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "p-2 rounded-md transition-colors",
                      isDockerSectionValid() && completedSections.includes("docker")
                        ? "bg-green-500/20 text-green-400"
                        : "bg-blue-500/10 text-blue-400",
                    )}
                  >
                    {isDockerSectionValid() && completedSections.includes("docker") ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <FileCode className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-medium">Docker Configuration</h3>
                      {isDockerSectionValid() && completedSections.includes("docker") && (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                          Completed
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mt-1">Use a custom Docker image for your deployment</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="docker-toggle"
                    checked={hasDocker}
                    onCheckedChange={(checked) => {
                      setHasDocker(checked)
                      if (completedSections.includes("docker")) {
                        setCompletedSections(completedSections.filter((s) => s !== "docker"))
                      }
                    }}
                    className="data-[state=checked]:bg-blue-600"
                  />
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 text-gray-400 transition-transform duration-200",
                      openSections.includes("docker") ? "transform rotate-180" : "",
                    )}
                  />
                </div>
              </div>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            <div className="px-5 pb-5 pt-2 space-y-4">
              <div className="h-px bg-gray-800/50 -mx-5 mb-4"></div>

              <AnimatePresence mode="wait">
                {hasDocker ? (
                  <motion.div
                    key="docker-config"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    <div className="flex justify-between items-center">
                      <Label htmlFor="docker-config" className="text-white">
                        Dockerfile Content
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-gray-400 hover:text-blue-400"
                              onClick={() => {
                                setDockerConfig(
                                  `FROM node:18-alpine\n\nWORKDIR /app\n\nCOPY package*.json ./\nRUN npm install\n\nCOPY . .\n\nRUN npm run build\n\nEXPOSE 3000\n\nCMD ["npm", "start"]`,
                                )
                              }}
                            >
                              <Code className="h-3.5 w-3.5 mr-1" />
                              Insert template
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Insert a basic Node.js Dockerfile template</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="relative">
                      <Textarea
                        id="docker-config"
                        placeholder="# Paste your Dockerfile content here..."
                        className="min-h-40 bg-gray-950 border-gray-800 text-gray-300 font-mono text-sm rounded-lg focus:ring-2 focus:ring-blue-500/50 transition-all resize-y"
                        value={dockerConfig}
                        onChange={(e) => {
                          setDockerConfig(e.target.value)
                          if (e.target.value.trim().length > 0) {
                            markSectionComplete("docker")
                          }
                        }}
                      />
                      <div className="absolute top-2 right-2 px-2 py-1 bg-gray-800 text-xs text-gray-400 rounded">
                        Dockerfile
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="standard-config"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="root-dir" className="text-white">
                            Root Directory
                          </Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 text-gray-500 hover:text-gray-400"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-3 w-3"
                                  >
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 16v-4" />
                                    <path d="M12 8h.01" />
                                  </svg>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="right">
                                <p className="text-xs max-w-xs">The directory where your application code is located</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="relative">
                          <Database className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                          <Input
                            id="root-dir"
                            placeholder="/"
                            className="bg-gray-950 border-gray-800 text-gray-300 pl-9 focus:ring-2 focus:ring-blue-500/50 transition-all"
                            value={rootDirectory}
                            onChange={(e) => {
                              setRootDirectory(e.target.value)
                              if (
                                e.target.value.trim().length > 0 &&
                                buildCommand.trim().length > 0 &&
                                runCommand.trim().length > 0
                              ) {
                                markSectionComplete("docker")
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="build-cmd" className="text-white">
                            Build Command
                          </Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 text-gray-500 hover:text-gray-400"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-3 w-3"
                                  >
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 16v-4" />
                                    <path d="M12 8h.01" />
                                  </svg>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="right">
                                <p className="text-xs max-w-xs">Command to build your application</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="relative">
                          <Terminal className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                          <Input
                            id="build-cmd"
                            placeholder="npm run build"
                            className="bg-gray-950 border-gray-800 text-gray-300 pl-9 focus:ring-2 focus:ring-blue-500/50 transition-all"
                            value={buildCommand}
                            onChange={(e) => {
                              setBuildCommand(e.target.value)
                              if (
                                rootDirectory.trim().length > 0 &&
                                e.target.value.trim().length > 0 &&
                                runCommand.trim().length > 0
                              ) {
                                markSectionComplete("docker")
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="run-cmd" className="text-white">
                          Run Command
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-gray-500 hover:text-gray-400">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="h-3 w-3"
                                >
                                  <circle cx="12" cy="12" r="10" />
                                  <path d="M12 16v-4" />
                                  <path d="M12 8h.01" />
                                </svg>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              <p className="text-xs max-w-xs">Command to start your application</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="relative">
                        <Terminal className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                        <Input
                          id="run-cmd"
                          placeholder="npm start"
                          className="bg-gray-950 border-gray-800 text-gray-300 pl-9 focus:ring-2 focus:ring-blue-500/50 transition-all"
                          value={runCommand}
                          onChange={(e) => {
                            setRunCommand(e.target.value)
                            if (
                              rootDirectory.trim().length > 0 &&
                              buildCommand.trim().length > 0 &&
                              e.target.value.trim().length > 0
                            ) {
                              markSectionComplete("docker")
                            }
                          }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Environment Variables */}
        <Collapsible
          open={openSections.includes("env")}
          onOpenChange={() => toggleSection("env")}
          className={cn(
            "rounded-lg border transition-all duration-200",
            isEnvSectionValid() && completedSections.includes("env")
              ? "border-green-500/30 bg-green-500/5"
              : "border-gray-800/50 bg-gray-900/30",
          )}
        >
          <div className="p-5">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "p-2 rounded-md transition-colors",
                      isEnvSectionValid() && completedSections.includes("env")
                        ? "bg-green-500/20 text-green-400"
                        : "bg-purple-500/10 text-purple-400",
                    )}
                  >
                    {isEnvSectionValid() && completedSections.includes("env") ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Key className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-medium">Environment Variables</h3>
                      {isEnvSectionValid() && completedSections.includes("env") && (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                          Completed
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mt-1">Add environment variables for your application</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="env-toggle"
                    checked={hasEnv}
                    onCheckedChange={(checked) => {
                      setHasEnv(checked)
                      if (!checked) {
                        markSectionComplete("env")
                      } else if (completedSections.includes("env")) {
                        setCompletedSections(completedSections.filter((s) => s !== "env"))
                      }
                    }}
                    className="data-[state=checked]:bg-purple-600"
                  />
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 text-gray-400 transition-transform duration-200",
                      openSections.includes("env") ? "transform rotate-180" : "",
                    )}
                  />
                </div>
              </div>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            <div className="px-5 pb-5 pt-2 space-y-4">
              <div className="h-px bg-gray-800/50 -mx-5 mb-4"></div>

              {hasEnv && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 px-1">
                    <div>KEY</div>
                    <div>VALUE</div>
                  </div>

                  <AnimatePresence>
                    {envVars.map((envVar, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0, overflow: "hidden" }}
                        transition={{ duration: 0.2 }}
                        className="flex gap-2 items-center group"
                      >
                        <div className="relative flex-1">
                          <Input
                            placeholder="KEY"
                            className="bg-gray-950 border-gray-800 text-gray-300 focus:ring-2 focus:ring-purple-500/50 transition-all pr-8"
                            value={envVar.key}
                            onChange={(e) => {
                              updateEnvVar(index, "key", e.target.value)
                              if (envVars.every((v) => v.key.trim() && v.value.trim())) {
                                markSectionComplete("env")
                              } else if (completedSections.includes("env")) {
                                setCompletedSections(completedSections.filter((s) => s !== "env"))
                              }
                            }}
                          />
                          {envVar.key && (
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                              {envVar.key.length}
                            </div>
                          )}
                        </div>
                        <div className="relative flex-1">
                          <Input
                            placeholder="VALUE"
                            className="bg-gray-950 border-gray-800 text-gray-300 focus:ring-2 focus:ring-purple-500/50 transition-all pr-8"
                            value={envVar.value}
                            onChange={(e) => {
                              updateEnvVar(index, "value", e.target.value)
                              if (envVars.every((v) => v.key.trim() && v.value.trim())) {
                                markSectionComplete("env")
                              } else if (completedSections.includes("env")) {
                                setCompletedSections(completedSections.filter((s) => s !== "env"))
                              }
                            }}
                          />
                          {envVar.value && (
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                              {envVar.value.length}
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeEnvVar(index)}
                          className="text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addEnvVar}
                      className="bg-gray-900 border-gray-800 text-gray-300 mt-2 hover:bg-purple-500/10 hover:text-purple-400 hover:border-purple-500/50 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5 mr-2" />
                      Add Variable
                    </Button>
                  </motion.div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Form Actions */}
        <div className="flex justify-between pt-6">
          <Button
            type="button"
            variant="outline"
            className="bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Back
          </Button>

          <Button
            type="submit"
            disabled={!(isDockerSectionValid() && isEnvSectionValid())}
            className={cn(
              "transition-all duration-300 flex items-center gap-2",
              isDockerSectionValid() && isEnvSectionValid()
                ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0"
                : "bg-gray-800 text-gray-400 cursor-not-allowed",
            )}
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
            </div>
          </motion.div>
        )}

        {transitionState === "redirecting" && (
          <motion.div
            key="redirecting"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center p-6 min-h-screen"
          >
            <div className="w-full max-w-2xl bg-gradient-to-br from-gray-900/80 to-gray-950/80 border border-gray-800/80 rounded-xl p-8 shadow-xl backdrop-blur-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    Setting Up Repository
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">Preparing your deployment environment</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 text-sm font-medium">Step 2 of 2</span>
                  <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"></div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center py-8">
                <div className="relative w-20 h-20 mb-6">
                  <div className="absolute inset-0 rounded-full border-t-2 border-blue-500 animate-spin"></div>
                  <div className="absolute inset-2 rounded-full border-r-2 border-purple-500 animate-spin animate-reverse"></div>
                  <div className="absolute inset-4 rounded-full border-b-2 border-teal-500 animate-spin animate-delay-500"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-blue-400 animate-pulse" />
                  </div>
                </div>

                <div className="w-full max-w-md">
                  <Progress value={progress} className="h-2 mb-2" />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Analyzing repository</span>
                    <span>{progress}%</span>
                  </div>
                </div>

                <div className="mt-8 text-center">
                  <p className="text-lg font-medium text-white mb-2">Preparing your workspace</p>
                  <p className="text-gray-400 text-sm max-w-md">
                    We are analyzing your code, setting up your repository, and configuring your deployment environment.
                    You will be redirected shortly...
                  </p>
                </div>

                <div className="mt-8 w-full max-w-md">
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                    <span>Setting up build environment</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                    <span>Configuring deployment settings</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
                    <span>Preparing development workspace</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
