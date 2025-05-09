/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */

"use client"

import type React from "react"

import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ExternalLink, GitBranch, Play, CheckCircle, XCircle, Clock, Terminal } from "lucide-react"

// Define types for our data structures
interface RepositoryConfig {
  id: string
  repositoryId: string
  hasDocker: boolean
  dockerConfig?: string
  rootDirectory?: string
  buildCommand?: string
  runCommand?: string
  environmentVariables?: any
  buildStatus?: string
  lastBuildId?: string
  lastBuildStartTime?: string
  deploymentUrl?: string
  createdAt: string
  updatedAt: string
}

interface Repository {
  id: string
  repoId: string
  name: string
  description?: string
  url: string
  userId: string
  createdAt: string
  updatedAt: string
  config?: RepositoryConfig
  repository: any
}

interface LogEntry {
  timestamp: string
  message: string
  level: "info" | "error" | "warning"
}

export default function RepositoryDetail() {
  const { repoId } = useParams()
  const { data: session, status } = useSession()
  const router = useRouter()

  const [repository, setRepository] = useState<null | Repository>(null)
  const [repoConfig, setRepoConfig] = useState<null | RepositoryConfig>(null)
  const [loading, setLoading] = useState(true)
  const [buildLoading, setBuildLoading] = useState(false)
  const [buildMessage, setBuildMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [dialogOpen, setDialogOpen] = useState(true)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [activeTab, setActiveTab] = useState<"details" | "logs">("details")

  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/sign-in")
    }
  }, [status, router])

  
  useEffect(() => {
    if (session && repoId) {
      fetchRepositoryDetails()
    }
  }, [session, repoId])

  // Auto-scroll logs to bottom when new logs are added
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [logs])

  // Mock function to simulate fetching logs from AWS
  // This would be replaced with actual AWS log fetching logic
  const fetchLogs = async () => {
    // This is a placeholder - you would implement actual AWS log fetching here
    const mockLogs: LogEntry[] = [
      { timestamp: new Date().toISOString(), message: "Initializing build process", level: "info" },
      { timestamp: new Date().toISOString(), message: "Cloning repository", level: "info" },
      { timestamp: new Date().toISOString(), message: "Installing dependencies", level: "info" },
      { timestamp: new Date().toISOString(), message: "Running build command", level: "info" },
      { timestamp: new Date().toISOString(), message: "Build completed successfully", level: "info" },
    ]

    setLogs(mockLogs)
  }

  const fetchRepositoryDetails = async () => {
    try {
      const repoResponse = await fetch(`/api/repoConfig/${repoId}`)
      if (!repoResponse.ok) {
        throw new Error("Repository not found")
      }

      const repoData = await repoResponse.json()
      setRepository(repoData)

      const configResponse = await fetch(`/api/repoConfig/${repoId}`)
      if (configResponse.ok) {
        const configData = await configResponse.json()
        setRepoConfig(configData)
      }

      // Fetch logs when repository details are loaded
      fetchLogs()
    } catch (error) {
      console.error("Error fetching repository details:", error)
      router.push("/dashboard")
    } finally {
      setLoading(false)
    }
  }

  const triggerBuild = async () => {
    setBuildLoading(true)
    setBuildMessage(null)

    try {
      const response = await fetch(`/api/repositories/${repoId}/build`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (response.ok) {
        setBuildMessage({
          type: "success",
          text: "Build triggered successfully! Build ID: " + data.buildId,
        })
        // Refresh the repository config to get updated build status
        fetchRepositoryDetails()
        // Close the dialog after successful build trigger
        setDialogOpen(false)
      } else {
        setBuildMessage({
          type: "error",
          text: data.error || "Failed to trigger build",
        })
      }
    } catch (error) {
      console.error("Error triggering build:", error)
      setBuildMessage({
        type: "error",
        text: "An error occurred while triggering the build",
      })
    } finally {
      setBuildLoading(false)
    }
  }

  const getBuildStatusBadge = (status?: string) => {
    if (!status) return null

    const statusVariants: Record<
      string,
      { variant: "outline" | "secondary" | "destructive" | "default"; icon: React.ReactNode }
    > = {
      PENDING: { variant: "secondary", icon: <Clock className="h-3 w-3 mr-1" /> },
      BUILDING: { variant: "secondary", icon: <Terminal className="h-3 w-3 mr-1" /> },
      DEPLOYED: { variant: "default", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      FAILED: { variant: "destructive", icon: <XCircle className="h-3 w-3 mr-1" /> },
    }

    const { variant, icon } = statusVariants[status] || { variant: "outline", icon: null }

    return (
      <Badge variant={variant} className="flex items-center">
        {icon}
        {status}
      </Badge>
    )
  }

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="container mx-auto px-4 py-8 min-h-screen bg-background text-foreground flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading repository details...</p>
        </motion.div>
      </div>
    )
  }

  if (!session) return null

  if (!repository) {
    return (
      <div className="container mx-auto px-4 py-8 min-h-screen bg-background text-foreground">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-card rounded-lg shadow-md p-8 text-center"
        >
          <h2 className="text-xl font-semibold mb-4">Repository not found</h2>
          <p className="text-muted-foreground mb-6">You may not have access to this repository.</p>
          <Button asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className=" max-w-7xl mx-auto px-4 pb-8 pt-20 min-h-screen bg-black text-foreground">
      <AnimatePresence>
        {dialogOpen && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Trigger Build</DialogTitle>
                <DialogDescription>
                  Do you want to trigger a new build for {repository.repository.name}?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Not now
                </Button>
                <Button onClick={triggerBuild} disabled={buildLoading} className="flex items-center gap-2">
                  {buildLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background"></div>
                      Building...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Trigger Build
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mb-6">
          <Button variant="ghost" asChild className="gap-1">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <Card className="overflow-hidden min-h-[800px]">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">{repository.repository.name}</CardTitle>

                {repository.repository.description && (
                  <CardDescription className="mt-2">{repository.repository.description}</CardDescription>
                )}
              </div>

              
            </div>

            {buildMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 p-3 rounded ${buildMessage.type === "success" ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"}`}
              >
                {buildMessage.text}
              </motion.div>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
              <Button variant="outline" asChild className="gap-2">
                <a href={repository.repository.url} target="_blank" rel="noopener noreferrer">
                  <GitBranch className="h-4 w-4" />
                  View on GitHub
                </a>
              </Button>

              {repoConfig?.deploymentUrl && (
                <Button variant="outline" asChild className="gap-2">
                  <a href={repoConfig.deploymentUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    View Deployment
                  </a>
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent>
            <div className="border-t border-border pt-4">
              <div className="flex mb-6 border-b border-border">
                <Button
                  variant={activeTab === "details" ? "default" : "ghost"}
                  onClick={() => setActiveTab("details")}
                  className="rounded-none rounded-t-lg"
                >
                  Repository Details
                </Button>
                <Button
                  variant={activeTab === "logs" ? "default" : "ghost"}
                  onClick={() => setActiveTab("logs")}
                  className="rounded-none rounded-t-lg"
                >
                  Build Logs
                </Button>
              </div>

              {activeTab === "details" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold">Repository Information</h2>
                    {repoConfig?.buildStatus && getBuildStatusBadge(repoConfig.buildStatus)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-muted-foreground">Added on</p>
                      <p className="font-medium">{new Date(repository.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last updated</p>
                      <p className="font-medium">{new Date(repository.updatedAt).toLocaleDateString()}</p>
                    </div>
                    {repoConfig?.lastBuildStartTime && (
                      <div>
                        <p className="text-muted-foreground">Last build</p>
                        <p className="font-medium">{new Date(repoConfig.lastBuildStartTime).toLocaleString()}</p>
                      </div>
                    )}
                    {repoConfig?.lastBuildId && (
                      <div>
                        <p className="text-muted-foreground">Build ID</p>
                        <p className="font-medium">{repoConfig.lastBuildId}</p>
                      </div>
                    )}
                  </div>

                  {repoConfig && (
                    <div className="border-t border-border pt-4">
                      <h2 className="text-lg font-semibold mb-3">Build Configuration</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-muted-foreground">Root Directory</p>
                          <p className="font-medium">{repoConfig.rootDirectory || "Not specified"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Build Command</p>
                          <p className="font-medium">{repoConfig.buildCommand || "Not specified"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Run Command</p>
                          <p className="font-medium">{repoConfig.runCommand || "Not specified"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Docker</p>
                          <p className="font-medium">{repoConfig.hasDocker ? "Enabled" : "Disabled"}</p>
                        </div>
                      </div>

                      {repoConfig.environmentVariables && (
                        <div className="mt-4">
                          <p className="text-muted-foreground mb-2">Environment Variables</p>
                          <div className="bg-card/50 p-3 rounded-md border border-border">
                            {Object.entries(repoConfig.environmentVariables).map(([key]) => (
                              <div key={key} className="flex items-center mb-1 last:mb-0">
                                <span className="font-medium mr-2">{key}:</span>
                                <span className="text-muted-foreground">●●●●●●●●</span>
                              </div>
                            ))}
                            {Object.entries(repoConfig.environmentVariables).length === 0 && (
                              <p className="text-muted-foreground italic">No environment variables configured</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === "logs" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="h-[400px] overflow-y-auto bg-black/50 rounded-md p-4 font-mono text-sm"
                >
                  {logs.length > 0 ? (
                    logs.map((log, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`mb-1 ${
                          log.level === "error"
                            ? "text-red-400"
                            : log.level === "warning"
                              ? "text-yellow-400"
                              : "text-green-400"
                        }`}
                      >
                        <span className="text-muted-foreground">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{" "}
                        {log.message}
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No logs available. Trigger a build to see logs.</p>
                  )}
                  <div ref={logsEndRef} />
                </motion.div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
