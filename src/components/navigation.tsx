import { useState } from 'react'
import {
  Video,
  Sparkles,
  LogOut,
  Loader2,
  Menu,
  X,
  Github,
} from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function Navigation() {
  const { data: session, isPending } = authClient.useSession()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const user = session?.user

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await authClient.signOut()
    } catch (error) {
      console.error('Sign out failed:', error)
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo Section */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Video className="h-8 w-8 text-blue-600" />
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-gray-900">
                  Video Analysis
                </h1>
                <p className="text-xs text-gray-500">
                  Powered by Vertex AI
                </p>
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            {/* GitHub Link */}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              asChild
            >
              <a
                href="https://github.com/austeane/llm-video-analysis"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-5 w-5" />
              </a>
            </Button>

            {/* User Account */}
            {isPending ? (
              <div className="flex items-center gap-2 px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                <span className="text-sm text-gray-500">Loading...</span>
              </div>
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 hover:bg-gray-100"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="text-left hidden lg:block">
                      <p className="text-sm font-medium text-gray-900">
                        {user.name || 'User'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {user.email}
                      </p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div>
                      <p className="text-sm font-medium">{user.name || 'User'}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-xs text-gray-500">
                    <Sparkles className="mr-2 h-3 w-3" />
                    Daily Budget: $3.00
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs text-gray-500">
                    <Sparkles className="mr-2 h-3 w-3" />
                    Global Budget: $10.00
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="text-red-600 focus:text-red-600"
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
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    // Scroll to auth section
                    document.getElementById('auth-section')?.scrollIntoView({
                      behavior: 'smooth'
                    })
                  }}
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => {
                    // Scroll to auth section
                    document.getElementById('auth-section')?.scrollIntoView({
                      behavior: 'smooth'
                    })
                  }}
                >
                  Get Started
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t py-4">
           {user ? (
              <div className="space-y-3">
                <div className="px-2 py-3 border-b">
                  <p className="text-sm font-medium text-gray-900">
                    {user.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {user.email}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-gray-500">
                    <p>Daily Budget: $3.00</p>
                    <p>Global Budget: $10.00</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-red-600"
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
              </div>
            ) : (
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    document.getElementById('auth-section')?.scrollIntoView({
                      behavior: 'smooth'
                    })
                  }}
                >
                  Sign In
                </Button>
                <Button
                  className="w-full justify-start"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    document.getElementById('auth-section')?.scrollIntoView({
                      behavior: 'smooth'
                    })
                  }}
                >
                  Get Started
                </Button>
              </div>
            )}
            <div className="mt-4 pt-4 border-t flex items-center justify-end px-2">
              <Button
                variant="ghost"
                size="sm"
                asChild
              >
                <a
                  href="https://github.com/austeane/llm-video-analysis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </a>
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
