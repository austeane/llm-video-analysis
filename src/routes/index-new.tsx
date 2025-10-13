import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-form-adapter'
import {
  AlertCircle,
  Loader2,
  Sparkles,
  Video,
  Clock,
  Brain,
  Shield,
  ChevronDown,
  ChevronUp,
  PlayCircle,
  FileText,
  CheckCircle,
  XCircle
} from 'lucide-react'

import type { AnalyzeResponse } from '@/lib/analysis-schema'
import { analyzeRequestSchema } from '@/lib/analysis-schema'
import { AnalyzeApiError, analyzeVideo } from '@/lib/analyze-api'
import { authClient } from '@/lib/auth-client'
import { Navigation } from '@/components/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export const Route = createFileRoute('/index-new')({
  component: VideoAnalysisPage,
})

function VideoAnalysisPage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set())
  const {
    data: session,
    isPending: sessionPending,
  } = authClient.useSession()
  const activeUser = session?.user ?? null

  // Initialize dark mode based on localStorage
  const form = useForm({
    defaultValues: {
      youtubeUrl: '',
      prompt: '',
    },
    validatorAdapter: zodValidator(),
    validators: {
      onSubmit: analyzeRequestSchema,
    },
    onSubmit: async ({ value }) => {
      if (!activeUser) {
        // Scroll to auth section
        document.getElementById('auth-section')?.scrollIntoView({
          behavior: 'smooth'
        })
        return
      }

      setIsAnalyzing(true)
      setResult(null)
      setExpandedSections(new Set())

      try {
        const response = await analyzeVideo(value)
        setResult(response)
      } catch (error) {
        console.error('Analysis failed:', error)

        if (error instanceof AnalyzeApiError && error.payload) {
          setResult(error.payload)
        } else {
          setResult({
            summary: 'Analysis Failed',
            metadata: {
              analysisTimestamp: new Date().toISOString(),
              model: 'error',
              processingTime: 0,
            },
            error:
              error instanceof Error
                ? error.message
                : 'An unexpected error occurred',
          })
        }
      } finally {
        setIsAnalyzing(false)
      }
    },
  })

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedSections(newExpanded)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <Navigation />

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50" />
        <div className="relative container mx-auto px-4 py-16 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-blue-400 to-purple-600 blur-xl opacity-50" />
              <Video className="relative h-16 w-16 text-blue-600" />
            </div>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-4">
            AI-Powered Video Analysis
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Transform any YouTube video into actionable insights using Google's most advanced AI models
          </p>

          {/* Feature badges */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <Badge variant="secondary" className="px-3 py-1 text-sm">
              <Brain className="mr-1 h-3 w-3" />
              Gemini 2.5 Pro
            </Badge>
            <Badge variant="secondary" className="px-3 py-1 text-sm">
              <Clock className="mr-1 h-3 w-3" />
              ~45s Analysis
            </Badge>
            <Badge variant="secondary" className="px-3 py-1 text-sm">
              <Shield className="mr-1 h-3 w-3" />
              Secure & Private
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Main Analysis Card */}
        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm mb-8">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Analyze Video</CardTitle>
                <CardDescription className="mt-2">
                  Paste a YouTube URL and describe what insights you need
                </CardDescription>
              </div>
              {activeUser && (
                <div className="text-right">
                  <p className="text-sm text-gray-500">Daily Budget</p>
                  <p className="text-lg font-semibold text-green-600">$3.00</p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                form.handleSubmit()
              }}
              className="space-y-6"
            >
              <FieldGroup>
                {/* YouTube URL Field */}
                <form.Field
                  name="youtubeUrl"
                  children={(field) => {
                    const isInvalid =
                      field.state.meta.isTouched &&
                      !field.state.meta.isValid
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor="youtubeUrl" className="flex items-center gap-2">
                          <PlayCircle className="h-4 w-4" />
                          YouTube URL
                        </FieldLabel>
                        <Input
                          id="youtubeUrl"
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) =>
                            field.handleChange(e.target.value)
                          }
                          aria-invalid={isInvalid}
                          placeholder="https://www.youtube.com/watch?v=..."
                          autoComplete="off"
                          disabled={isAnalyzing}
                          className="h-12 text-base"
                        />
                        <FieldDescription>
                          Works with any public YouTube video
                        </FieldDescription>
                        {isInvalid && (
                          <FieldError errors={field.state.meta.errors} />
                        )}
                      </Field>
                    )
                  }}
                />

                {/* Analysis Prompt Field */}
                <form.Field
                  name="prompt"
                  children={(field) => {
                    const isInvalid =
                      field.state.meta.isTouched &&
                      !field.state.meta.isValid
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor="prompt" className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Analysis Instructions
                        </FieldLabel>
                        <Textarea
                          id="prompt"
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) =>
                            field.handleChange(e.target.value)
                          }
                          aria-invalid={isInvalid}
                          placeholder="Examples:
• Summarize the key points and takeaways
• Extract all technical concepts mentioned
• List actionable steps or recommendations
• Identify the main arguments and evidence"
                          className="min-h-[120px] text-base"
                          disabled={isAnalyzing}
                        />
                        <FieldDescription>
                          Be specific about what you want to learn
                        </FieldDescription>
                        {isInvalid && (
                          <FieldError errors={field.state.meta.errors} />
                        )}
                      </Field>
                    )
                  }}
                />
              </FieldGroup>

              <Button
                type="submit"
                disabled={isAnalyzing || !activeUser}
                className="w-full h-12 text-base bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Analyzing Video...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Analyze Video
                  </>
                )}
              </Button>

              {!activeUser && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-amber-800 font-medium">
                        Sign in required
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        Create a free account to start analyzing videos
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Results Display */}
        {result && (
          <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="border-b">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-2xl flex items-center gap-2">
                    {result.error ? (
                      <>
                        <XCircle className="h-6 w-6 text-red-500" />
                        Analysis Error
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-6 w-6 text-green-500" />
                        Analysis Complete
                      </>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-2">
                    {result.metadata.videoTitle || 'Video Analysis Results'}
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Badge variant="secondary" className="text-sm">
                    {result.metadata.model}
                  </Badge>
                  <Badge variant="outline" className="text-sm">
                    <Clock className="mr-1 h-3 w-3" />
                    {(result.metadata.processingTime / 1000).toFixed(1)}s
                  </Badge>
                  {result.metadata.billing && (
                    <Badge variant="outline" className="text-sm">
                      ${result.metadata.billing.cost.toFixed(4)}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {result.error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-red-700">
                    {result.error}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Section */}
                  <div className="rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 p-6">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-blue-600" />
                      Summary
                    </h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {result.summary}
                    </p>
                  </div>

                  {/* Detailed Sections */}
                  {result.sections && result.sections.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">
                        Detailed Analysis
                      </h3>
                      <div className="space-y-3">
                        {result.sections.map((section, index) => (
                          <div
                            key={index}
                            className="rounded-lg border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-md"
                          >
                            <button
                              onClick={() => toggleSection(index)}
                              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center text-sm font-semibold">
                                  {index + 1}
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900">
                                    {section.title}
                                  </h4>
                                  {section.timestamp !== undefined && (
                                    <span className="text-xs text-gray-500">
                                      {formatTimestamp(section.timestamp)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {expandedSections.has(index) ? (
                                <ChevronUp className="h-5 w-5 text-gray-400" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-gray-400" />
                              )}
                            </button>
                            {expandedSections.has(index) && (
                              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50/50">
                                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                                  {section.content}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw Analysis */}
                  {result.rawAnalysis && (
                    <details className="group">
                      <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 flex items-center gap-2">
                        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                        View Raw Analysis
                      </summary>
                      <pre className="mt-4 p-4 bg-gray-100 rounded-lg text-xs overflow-x-auto font-mono">
                        {result.rawAnalysis}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </CardContent>

            {!result.error && (
              <CardFooter className="border-t text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <span>
                    Analyzed on {new Date(result.metadata.analysisTimestamp).toLocaleString()}
                  </span>
                  {result.metadata.videoDuration && (
                    <span>
                      Video duration: {formatTimestamp(result.metadata.videoDuration)}
                    </span>
                  )}
                  {result.metadata.billing && (
                    <span>
                      Tokens: {result.metadata.billing.inputTokens.toLocaleString()} / {result.metadata.billing.outputTokens.toLocaleString()}
                    </span>
                  )}
                </div>
              </CardFooter>
            )}
          </Card>
        )}

        {/* Auth Section */}
        {!activeUser && !sessionPending && (
          <div id="auth-section" className="mt-12">
            <AuthCard />
          </div>
        )}
      </div>
    </div>
  )
}

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function AuthCard() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)
    setError(null)
    setIsSubmitting(true)

    try {
      if (mode === 'signIn') {
        const { error: signInError } = await authClient.signIn.email({
          email: formData.email,
          password: formData.password,
        })

        if (signInError) {
          setError(signInError.message ?? 'Unable to sign in.')
          return
        }

        setMessage('Signed in successfully.')
        window.location.reload()
      } else {
        const signUpInput: {
          email: string
          password: string
          name?: string
        } = {
          email: formData.email,
          password: formData.password,
        }

        const trimmedName = formData.name.trim()
        if (trimmedName) {
          signUpInput.name = trimmedName
        }

        const { error: signUpError } = await authClient.signUp.email(
          signUpInput,
        )

        if (signUpError) {
          setError(signUpError.message ?? 'Unable to create an account.')
          return
        }

        setMessage('Account created successfully!')
        window.location.reload()
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Authentication request failed.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm max-w-md mx-auto">
      <CardHeader className="text-center border-b">
        <CardTitle className="text-2xl">Get Started</CardTitle>
        <CardDescription>
          Create an account to start analyzing videos
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
          <Button
            type="button"
            variant={mode === 'signIn' ? 'default' : 'ghost'}
            onClick={() => {
              setMode('signIn')
              setMessage(null)
              setError(null)
            }}
            className="flex-1"
          >
            Sign In
          </Button>
          <Button
            type="button"
            variant={mode === 'signUp' ? 'default' : 'ghost'}
            onClick={() => {
              setMode('signUp')
              setMessage(null)
              setError(null)
            }}
            className="flex-1"
          >
            Create Account
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="auth-email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  email: event.target.value,
                }))
              }
              required
              disabled={isSubmitting}
              className="h-11"
            />
          </div>

          {mode === 'signUp' && (
            <div className="space-y-2">
              <label
                htmlFor="auth-name"
                className="block text-sm font-medium text-gray-700"
              >
                Name
              </label>
              <Input
                id="auth-name"
                autoComplete="name"
                value={formData.name}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                required
                disabled={isSubmitting}
                className="h-11"
              />
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="auth-password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <Input
              id="auth-password"
              type="password"
              autoComplete={
                mode === 'signIn' ? 'current-password' : 'new-password'
              }
              value={formData.password}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  password: event.target.value,
                }))
              }
              required
              minLength={8}
              disabled={isSubmitting}
              className="h-11"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === 'signIn' ? 'Signing in...' : 'Creating account...'}
              </>
            ) : (
              <>{mode === 'signIn' ? 'Sign In' : 'Create Account'}</>
            )}
          </Button>
        </form>

        {(error || message) && (
          <div className="mt-4 rounded-lg border border-gray-200 p-3 text-sm">
            {error ? (
              <div className="flex items-start gap-2 text-red-600">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-green-600">
                <CheckCircle className="mt-0.5 h-4 w-4" />
                <span>{message}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
