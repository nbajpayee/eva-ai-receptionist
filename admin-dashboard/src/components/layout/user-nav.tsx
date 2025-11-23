'use client'

/**
 * User Navigation Component
 * Displays user profile and logout option in the header
 */

import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, User, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { logError } from '@/lib/logger'

export function UserNav() {
  const { user, profile, signOut } = useAuth()
  const router = useRouter()

  // Render user menu as long as we have an authenticated Supabase user.
  // Profile information is optional and will fall back to user email when missing.
  if (!user) {
    return null
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      logError(error, { context: 'signOut', userId: user.id })
    } finally {
      router.replace('/login')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-200 text-zinc-700">
            <User className="h-4 w-4" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {profile?.full_name || user.email || 'User'}
            </p>
            <p className="text-xs leading-none text-zinc-500">
              {profile?.email || user.email}
            </p>
            <p className="text-xs leading-none text-zinc-400 capitalize mt-1">
              Role: {profile?.role ?? 'unknown'}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/settings')}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
