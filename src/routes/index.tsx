import { useEffect, useState } from 'react'

import { useForm } from '@tanstack/react-form'
import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-form-adapter'
import { AlertCircle, Loader2, LogOut, Sparkles, Video } from 'lucide-react'

import type { FormEvent } from 'react'
import type { AnalyzeFormData, AnalyzeResponse } from '@/lib/analysis-schema'
import { analyzeRequestSchema } from '@/lib/analysis-schema'
import { analyzeVideo } from '@/lib/analyze-api'
import { authClient } from '@/lib/auth-client'
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

export const Route = createFileRoute('/')({
  component: VideoAnalysisPage,
})

function VideoAnalysisPage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const {
    data: session,
    isPending: sessionPending,
    error: sessionError,
  } = authClient.useSession()
  const activeUser = session?.user ?? null

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
      setIsAnalyzing(true)
      setResult(null)

      try {
        const response = await analyzeVideo(value)
        setResult(response)
      } catch (error) {
        console.error('Analysis failed:', error)
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
      } finally {
        setIsAnalyzing(false)
      }
    },
  })

  const resultCard = result
    ? (() => {
        const { metadata, sections = [], rawAnalysis, error } = result

        return (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Analysis Results</CardTitle>
                  <CardDescription className="mt-2">
                    {metadata.videoTitle ?? 'Video Analysis'}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">{metadata.model}</Badge>
                  <Badge variant="outline">
                    {(metadata.processingTime / 1000).toFixed(2)}s
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-red-900 dark:text-red-100">
                        Analysis Error
                      </h3>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        {error}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Summary</h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {result.summary}
                    </p>
                  </div>

                  {sections.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">
                        Detailed Analysis
                      </h3>
                      <div className="space-y-4">
                        {sections.map((section, index) => (
                          <div
                            key={index}
                            className="rounded-lg border border-gray-200 dark:border-gray-800 p-4"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-medium text-gray-900 dark:text-white">
                                {section.title}
                              </h4>
                              {section.timestamp !== undefined && (
                                <Badge variant="outline" className="text-xs">
                                  {formatTimestamp(section.timestamp)}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                              {section.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {rawAnalysis && (
                    <details className="mt-6">
                      <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        View Raw Analysis
                      </summary>
                      <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg text-xs overflow-x-auto">
                        {rawAnalysis}
                      </pre>
                    </details>
                  )}
                </>
              )}
            </CardContent>
            {!error && (
              <CardFooter className="text-xs text-gray-500 dark:text-gray-400">
                Analyzed on{' '}
                {new Date(metadata.analysisTimestamp).toLocaleString()}
                {metadata.videoDuration && (
                  <>
                    {' '}
                    • Video duration: {formatTimestamp(metadata.videoDuration)}
                  </>
                )}
              </CardFooter>
            )}
          </Card>
        )
      })()
    : null

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Video className="h-10 w-10 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              LLM Video Analysis
            </h1>
            <Sparkles className="h-10 w-10 text-blue-600" />
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Analyze YouTube videos with AI-powered insights using Vertex AI
          </p>
        </div>

        {sessionPending ? (
          <LoadingCard />
        ) : !activeUser ? (
          <AuthCard initialError={sessionError?.message} />
        ) : (
          <>
            <AccountCard
              user={{
                name:
                  activeUser.name || activeUser.email || 'Authenticated User',
                email: activeUser.email || 'Unknown email',
              }}
            />

            {/* Main Form Card */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Analyze a Video</CardTitle>
                <CardDescription>
                  Enter a YouTube URL and describe what you'd like to analyze
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                            <FieldLabel htmlFor="youtubeUrl">
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
                            />
                            <FieldDescription>
                              Paste a YouTube video URL to analyze
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
                            <FieldLabel htmlFor="prompt">
                              Analysis Prompt
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
                              placeholder="What would you like to analyze about this video? (e.g., 'Summarize the main points', 'Extract technical concepts', 'List action items')"
                              className="min-h-[100px]"
                              disabled={isAnalyzing}
                            />
                            <FieldDescription>
                              Describe what insights you want from the video
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
                    disabled={isAnalyzing}
                    className="w-full"
                    size="lg"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing Video...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Analyze Video
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Results Display */}
            {resultCard}
          </>
        )}
      </div>
    </div>
  )
}

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function LoadingCard() {
  return (
    <Card className="mb-8">
      <CardContent className="flex items-center justify-center gap-3 py-10">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        <span className="text-sm text-gray-600 dark:text-gray-300">
          Loading account session...
        </span>
      </CardContent>
    </Card>
  )
}

function AuthCard({ initialError }: { initialError?: string }) {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(initialError ?? null)

  useEffect(() => {
    setError(initialError ?? null)
  }, [initialError])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
          setError(signInError.message)
          return
        }

        setMessage('Signed in successfully.')
      } else {
        const { error: signUpError } = await authClient.signUp.email({
          email: formData.email,
          password: formData.password,
          name: formData.name || undefined,
        })

        if (signUpError) {
          setError(signUpError.message)
          return
        }

        setMessage(
          'Account created successfully. Check your email if verification is required.',
        )
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
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Sign in to continue</CardTitle>
        <CardDescription>
          Create an account or sign in to analyze videos with Better Auth
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-6">
          <Button
            type="button"
            variant={mode === 'signIn' ? 'default' : 'ghost'}
            onClick={() => {
              setMode('signIn')
              setMessage(null)
              setError(initialError ?? null)
            }}
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
          >
            Create Account
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="auth-email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
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
            />
          </div>

          {mode === 'signUp' && (
            <div className="space-y-2">
              <label
                htmlFor="auth-name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
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
              />
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="auth-password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
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
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
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
          <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-800 p-3 text-sm">
            {error ? (
              <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : (
              <div className="text-green-600 dark:text-green-400">
                {message}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AccountCard({
  user,
}: {
  user: {
    name: string
    email: string
  }
}) {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Signed in</CardTitle>
        <CardDescription>{user.name}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {user.email}
          </p>
        </div>
        <SignOutButton />
      </CardContent>
    </Card>
  )
}

function SignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    setError(null)

    try {
      await authClient.signOut()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign out failed.')
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleSignOut}
        disabled={isSigningOut}
      >
        {isSigningOut ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing out...
          </>
        ) : (
          <>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </>
        )}
      </Button>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  )
}
