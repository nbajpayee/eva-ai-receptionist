"use client";

/**
 * User Navigation Component
 * Displays user profile and logout option in the header
 * Redesigned with premium, modern aesthetic
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
import { LogOut, User, Settings, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export function UserNav() {
  const { user, profile, signOut } = useAuth()
  const router = useRouter()

  // Render user menu as long as we have an authenticated Supabase user.
  if (!user) {
    return null
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      router.replace('/login')
    }
  }

  const displayName = profile?.full_name || user.email?.split('@')[0] || 'User';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="group relative h-10 w-auto gap-3 rounded-full pl-2 pr-3 hover:bg-white/50 transition-all">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-xs font-semibold text-white shadow-md shadow-sky-500/20 ring-2 ring-white">
            {initials}
          </div>
          <div className="flex flex-col items-start text-xs hidden sm:flex">
             <span className="font-semibold text-zinc-700 group-hover:text-zinc-900">{displayName}</span>
             <span className="text-zinc-400 font-medium capitalize">{profile?.role ?? 'Admin'}</span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400 transition-transform group-data-[state=open]:rotate-180" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60 p-2" align="end" forceMount>
        <div className="flex items-center gap-3 p-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                <User className="h-5 w-5" />
            </div>
            <div className="flex flex-col space-y-0.5">
                <p className="text-sm font-semibold text-zinc-900">{displayName}</p>
                <p className="text-[10px] font-medium text-zinc-500 truncate max-w-[140px]">
                    {user.email}
                </p>
            </div>
        </div>
        <DropdownMenuSeparator className="my-1 bg-zinc-100" />
        <DropdownMenuItem 
            onClick={() => router.push('/settings')}
            className="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-zinc-600 focus:bg-zinc-50 focus:text-zinc-900"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white group-hover:border-zinc-300 transition-colors">
             <Settings className="h-3.5 w-3.5" />
          </div>
          Account Settings
        </DropdownMenuItem>
        <DropdownMenuItem 
            onSelect={handleSignOut}
            className="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-rose-600 focus:bg-rose-50 focus:text-rose-700"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-100 bg-rose-50 group-hover:bg-rose-100 transition-colors">
             <LogOut className="h-3.5 w-3.5" />
          </div>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
