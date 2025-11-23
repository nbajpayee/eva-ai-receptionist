'use client'

/**
 * Login Page
 * Authentication page for admin dashboard access
 * Redesigned with premium, modern aesthetic matching marketing site
 */

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { 
  AlertCircle, 
  Loader2, 
  Shield, 
  Lock, 
  CheckCircle2, 
  ArrowRight
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Balancer from 'react-wrap-balancer'
import { cn } from '@/lib/utils'

// --- Components ---

const TrustBadge = ({ icon: Icon, text }: { icon: any, text: string }) => (
  <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200/60 bg-zinc-50/50 px-3 py-1.5 text-xs font-medium text-zinc-600 backdrop-blur-sm transition-colors hover:bg-zinc-100/80">
    <Icon className="h-3.5 w-3.5 text-sky-600" />
    <span>{text}</span>
  </div>
)

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: 'spring', stiffness: 300, damping: 24 }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Simulate minimum loading time for UX
    const startTime = Date.now()

    try {
      const { error } = await signIn(email, password)

      // Ensure at least 800ms loading state for smooth animation
      const elapsed = Date.now() - startTime
      if (elapsed < 800) {
        await new Promise(resolve => setTimeout(resolve, 800 - elapsed))
      }

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      // Success state before redirect
      router.push(redirect)
      router.refresh()
    } catch {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-zinc-50 selection:bg-sky-100 selection:text-sky-900">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="absolute inset-0 bg-gradient-to-br from-sky-50/50 via-white to-sky-50/30" />
      
      {/* Animated Orbs */}
      <motion.div 
        animate={{ 
          y: [0, -20, 0],
          opacity: [0.3, 0.5, 0.3] 
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-20 top-20 h-[600px] w-[600px] rounded-full bg-sky-200/40 blur-[120px]" 
      />
      <motion.div 
        animate={{ 
          y: [0, 30, 0],
          opacity: [0.2, 0.4, 0.2] 
        }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute -right-20 bottom-20 h-[500px] w-[500px] rounded-full bg-blue-200/30 blur-[100px]" 
      />

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[480px] px-4"
      >
        <Card className="relative overflow-hidden rounded-3xl border border-white/50 bg-white/70 p-8 shadow-2xl backdrop-blur-xl ring-1 ring-zinc-900/5 sm:p-12">
          {/* Decorative top gradient */}
          <div className="absolute left-0 top-0 h-2 w-full bg-gradient-to-r from-sky-400 via-blue-500 to-sky-400 opacity-80" />
          
          <div className="mb-10 flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring" }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white/80 px-4 py-1.5 text-sm font-medium text-sky-700 shadow-sm backdrop-blur-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500"></span>
              </span>
              Admin Portal
            </motion.div>

            <h1 className="mb-3 text-4xl font-bold tracking-tight text-zinc-900">
              <span className="bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">Eva</span> Receptionist
            </h1>
            <Balancer className="text-lg text-zinc-600">
              Welcome back. Sign in to manage your AI receptionist.
            </Balancer>
          </div>

          <motion.form 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            onSubmit={handleSubmit} 
            className="space-y-6"
          >
            <div className="space-y-5">
              <motion.div variants={itemVariants}>
                <Label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Email address
                </Label>
                <div className="group relative">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={cn(
                      "h-12 rounded-xl border-zinc-200 bg-zinc-50/30 px-4 transition-all duration-200",
                      "focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20",
                      "group-hover:border-zinc-300"
                    )}
                    placeholder="name@company.com"
                    disabled={loading}
                  />
                </div>
              </motion.div>

              <motion.div variants={itemVariants}>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-zinc-700">
                    Password
                  </Label>
                  <a href="#" className="text-xs font-medium text-sky-600 hover:text-sky-700">
                    Forgot password?
                  </a>
                </div>
                <div className="group relative">
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(
                      "h-12 rounded-xl border-zinc-200 bg-zinc-50/30 px-4 transition-all duration-200",
                      "focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20",
                      "group-hover:border-zinc-300"
                    )}
                    placeholder="••••••••"
                    disabled={loading}
                  />
                </div>
              </motion.div>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                >
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                  <span className="font-medium">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div variants={itemVariants}>
              <Button
                type="submit"
                className={cn(
                  "group relative h-12 w-full overflow-hidden rounded-full text-base font-semibold shadow-lg transition-all duration-300",
                  "bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500",
                  "hover:-translate-y-0.5 hover:shadow-sky-500/30",
                  loading && "cursor-not-allowed opacity-90"
                )}
                disabled={loading}
              >
                <div className="relative flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign in</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </div>
              </Button>
            </motion.div>
          </motion.form>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-10 flex flex-wrap justify-center gap-3"
          >
            <TrustBadge icon={Shield} text="HIPAA Compliant" />
            <TrustBadge icon={Lock} text="256-bit Encryption" />
            <TrustBadge icon={CheckCircle2} text="99.9% Uptime" />
          </motion.div>
        </Card>
        
        <p className="mt-8 text-center text-sm text-zinc-400">
          &copy; {new Date().getFullYear()} Eva AI. All rights reserved.
        </p>
      </motion.div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
