'use client'

/**
 * Provider Performance Page
 * Redesigned with premium aesthetic, glassmorphism, and advanced animations.
 */

import { useState, useEffect, useMemo } from 'react'
import { 
  LayoutGroup, 
  motion, 
  AnimatePresence, 
  useMotionValue, 
  useTransform, 
  animate 
} from 'framer-motion'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Target, 
  Award, 
  Calendar, 
  Download, 
  Search,
  MoreHorizontal,
  ArrowUpRight,
  Star,
  Activity
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'

// --- Types ---

type ProviderSummary = {
  provider_id: string
  name: string
  email: string
  avatar_url: string | null
  specialties: string[]
  total_consultations: number
  successful_bookings: number
  conversion_rate: number
  total_revenue: number
  avg_satisfaction_score: number | null
}

type ProviderSummaryResponse = {
  providers: ProviderSummary[]
  period_days: number
}

// --- Animation Variants ---

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 }
  }
}

const chartVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" as const }
  }
}

// --- Components ---

const Counter = ({ value, prefix = '', suffix = '', decimals = 0 }: { value: number, prefix?: string, suffix?: string, decimals?: number }) => {
  const count = useMotionValue(0)
  const rounded = useTransform(count, latest => {
    return prefix + latest.toFixed(decimals) + suffix
  })

  useEffect(() => {
    const controls = animate(count, value, { duration: 1.5, ease: "easeOut" })
    return controls.stop
  }, [value, count])

  return <motion.span>{rounded}</motion.span>
}

const StatCard = ({ 
  title, 
  value, 
  prefix = '', 
  suffix = '', 
  decimals = 0, 
  icon: Icon, 
  trend, 
  trendLabel,
  colorClass = "text-foreground"
}: any) => {
  // Generate background color from text color (e.g. text-emerald-600 -> bg-emerald-100)
  // We use the new palette: primary is sky/teal, so we adapt.
  const bgClass = colorClass.includes('sky') ? 'bg-sky-100' : 
                 colorClass.includes('teal') ? 'bg-teal-100' :
                 colorClass.includes('cyan') ? 'bg-cyan-100' :
                 colorClass.includes('amber') ? 'bg-amber-100' : 'bg-slate-100';
  
  return (
    <Card className="relative overflow-hidden border-border bg-card backdrop-blur-xl transition-all duration-300 hover:shadow-lg hover:shadow-sky-100/50">
      <div className="absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-gradient-to-br from-slate-100 to-transparent opacity-50 blur-2xl" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("rounded-full p-2", bgClass)}>
          <Icon className={cn("h-4 w-4", colorClass)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">
          <Counter value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
        </div>
        <div className="mt-1 flex items-center text-xs">
          {trend > 0 ? (
            <span className="flex items-center text-teal-600 font-medium">
              <TrendingUp className="mr-1 h-3 w-3" />
              +{trend}%
            </span>
          ) : (
            <span className="flex items-center text-rose-600 font-medium">
              <TrendingDown className="mr-1 h-3 w-3" />
              {trend}%
            </span>
          )}
          <span className="ml-1.5 text-muted-foreground">{trendLabel}</span>
        </div>
      </CardContent>
    </Card>
  )
}

const ProviderCard = ({ provider, maxRevenue }: { provider: ProviderSummary, maxRevenue: number }) => {
  const initials = provider.name.split(' ').map(n => n[0]).join('').substring(0, 2)
  
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative"
    >
      <Link href={`/providers/${provider.provider_id}`}>
        <Card className="h-full border-border bg-card overflow-hidden transition-all duration-300 hover:border-sky-200 hover:shadow-xl hover:shadow-sky-100/50">
          {/* Decorative background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-sky-50/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          
          {/* Absolute Positioned Badge */}
          <div className="absolute top-4 right-4 z-20">
            <Badge 
              variant="secondary" 
              className={cn(
                "font-medium border shadow-sm",
                provider.conversion_rate >= 50 
                  ? "bg-teal-50 text-teal-700 border-teal-100" 
                  : "bg-slate-50 text-slate-600 border-slate-100"
              )}
            >
              {provider.conversion_rate.toFixed(0)}% Conv.
            </Badge>
          </div>

          <CardHeader className="relative z-10 flex flex-row items-start gap-4 space-y-0 pb-2 pt-5 px-5">
            <div className="relative flex-shrink-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-teal-500 text-white font-bold shadow-sm ring-2 ring-white">
                {provider.avatar_url ? (
                  <img src={provider.avatar_url} alt={provider.name} className="h-full w-full rounded-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              {provider.avg_satisfaction_score && provider.avg_satisfaction_score >= 4.8 && (
                <div className="absolute -bottom-1 -right-1 rounded-full bg-amber-400 p-1 ring-2 ring-white shadow-sm">
                  <Star className="h-3 w-3 fill-white text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 pt-1 pr-16"> {/* Added padding right to avoid badge overlap */}
              <h3 className="font-semibold text-foreground truncate text-base group-hover:text-primary transition-colors">
                {provider.name}
              </h3>
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {provider.specialties.length > 0 ? provider.specialties[0] : 'General'}
              </p>
            </div>
          </CardHeader>
          
          <CardContent className="relative z-10 space-y-5 px-5 pb-5">
            {/* Revenue Section */}
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-xs font-medium text-muted-foreground">Revenue Generated</span>
                <span className="text-sm font-bold text-foreground">${provider.total_revenue.toLocaleString()}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100/80 ring-1 ring-inset ring-slate-900/5">
                <motion.div 
                  initial={{ width: 0 }}
                  whileInView={{ width: `${Math.max((provider.total_revenue / maxRevenue) * 100, 0)}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full",
                    provider.total_revenue > 0 
                      ? "bg-gradient-to-r from-sky-400 to-teal-500"
                      : "bg-transparent"
                  )}
                />
              </div>
            </div>

            {/* Stats Grid - Removed Box, Just Dividers */}
            <div className="flex items-center py-2">
              <div className="flex-1 text-center border-r border-border">
                <p className="text-xs text-muted-foreground font-medium">Consults</p>
                <p className="mt-1 text-xl font-bold text-slate-700">{provider.total_consultations}</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground font-medium">Bookings</p>
                <p className="mt-1 text-xl font-bold text-primary">{provider.successful_bookings}</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-1 border-t border-border mt-2">
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors mt-3">
                View Profile <ArrowUpRight className="h-3 w-3" />
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}

const LeaderboardRow = ({ provider, rank }: { provider: ProviderSummary, rank: number }) => (
  <motion.div 
    variants={itemVariants}
    className="group flex items-center gap-3 rounded-xl border border-transparent p-2.5 transition-all hover:bg-muted/50 hover:border-border"
  >
    <div className={cn(
      "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-bold text-xs shadow-sm",
      rank === 1 ? "bg-amber-100 text-amber-700 border border-amber-200" :
      rank === 2 ? "bg-slate-100 text-slate-700 border border-slate-200" :
      rank === 3 ? "bg-orange-100 text-orange-800 border border-orange-200" :
      "bg-transparent text-muted-foreground"
    )}>
      {rank}
    </div>
    
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-teal-50 text-sky-700 text-xs font-bold shadow-sm">
      {provider.name.charAt(0)}
    </div>
    
    <div className="flex-1 min-w-0 pr-2">
      <h4 className="font-medium text-foreground text-sm truncate">{provider.name}</h4>
      <p className="text-xs text-muted-foreground truncate max-w-[120px]">{provider.specialties[0] || 'Specialist'}</p>
    </div>

    <div className="text-right flex-shrink-0">
      <span className="block text-sm font-bold text-foreground">{provider.conversion_rate.toFixed(1)}%</span>
      <span className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Conv</span>
    </div>
  </motion.div>
)

// --- Main Page ---

export default function ProvidersPage() {
  const [data, setData] = useState<ProviderSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodDays, setPeriodDays] = useState(30)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    const fetchProviders = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/providers/summary?days=${periodDays}`)
        const json = await res.json()
        setData(json)
      } catch (error) {
        console.error("Failed to fetch providers:", error)
      } finally {
        // Add a small delay to let animations play nicely if data loads too fast
        setTimeout(() => setLoading(false), 500)
      }
    }
    fetchProviders()
  }, [periodDays])

  const filteredProviders = useMemo(() => {
    if (!data?.providers) return []
    return data.providers.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [data, searchQuery])

  const sortedByRevenue = useMemo(() => {
    return [...filteredProviders].sort((a, b) => b.total_revenue - a.total_revenue)
  }, [filteredProviders])

  const sortedByConversion = useMemo(() => {
    return [...filteredProviders].sort((a, b) => b.conversion_rate - a.conversion_rate)
  }, [filteredProviders])

  const totalRevenue = filteredProviders.reduce((sum, p) => sum + p.total_revenue, 0)
  const avgConversion = filteredProviders.length > 0 
    ? filteredProviders.reduce((sum, p) => sum + p.conversion_rate, 0) / filteredProviders.length 
    : 0
  const totalBookings = filteredProviders.reduce((sum, p) => sum + p.successful_bookings, 0)

  // Max revenue for progress bars
  const maxRevenue = Math.max(...filteredProviders.map(p => p.total_revenue), 0)

  if (loading) {
    return (
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-8 font-sans">
      <div className="mx-auto max-w-7xl space-y-8">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
        >
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Provider Performance</h1>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              Monitor team performance, revenue attribution, and conversion metrics in real-time.
          </p>
        </div>

          <div className="flex items-center gap-2">
            <Select value={periodDays.toString()} onValueChange={(v) => setPeriodDays(parseInt(v))}>
              <SelectTrigger className="w-[140px] bg-card border-border shadow-sm">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{periodDays === 7 ? 'Last 7 days' : periodDays === 30 ? 'Last 30 days' : 'Last 90 days'}</span>
                  </div>
                </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
            
            <Button variant="outline" className="bg-card shadow-sm border-border">
              <Download className="mr-2 h-4 w-4 text-muted-foreground" />
              Export
            </Button>
            </div>
        </motion.div>

        {/* Stats Overview */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          <StatCard 
            title="Total Revenue" 
            value={totalRevenue} 
            prefix="$" 
            icon={DollarSign}
            trend={12.5}
            trendLabel="vs last period"
            colorClass="text-sky-500"
          />
          <StatCard 
            title="Avg Conversion" 
            value={avgConversion} 
            suffix="%" 
            decimals={1}
            icon={Target}
            trend={-2.4}
            trendLabel="vs last period"
            colorClass="text-teal-500"
          />
          <StatCard 
            title="Total Bookings" 
            value={totalBookings} 
            icon={Users}
            trend={8.2}
            trendLabel="vs last period"
            colorClass="text-cyan-600"
          />
          <StatCard 
            title="Active Providers" 
            value={filteredProviders.length} 
            icon={Activity}
            trend={0}
            trendLabel="stable"
            colorClass="text-amber-500"
          />
        </motion.div>

        {/* Main Content Area */}
        <div className="grid gap-6 lg:grid-cols-3">
          
          {/* Left Column: Chart & Grid (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Chart Section */}
            <motion.div
              variants={chartVariants}
              initial="hidden"
              animate="visible"
            >
              <Card className="overflow-hidden border-border bg-card shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Revenue & Conversion Comparison</CardTitle>
                  <CardDescription>Top performing providers by revenue contribution</CardDescription>
                </CardHeader>
                <CardContent className="pl-0">
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sortedByRevenue.slice(0, 6)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.92 0.01 260)" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: 'oklch(0.55 0.04 260)', fontSize: 12, fontWeight: 500 }}
                          tickFormatter={(val: string) => val.split(' ')[1] || val.split(' ')[0]} 
                          interval={0}
                        />
                        <YAxis 
                          yAxisId="left" 
                          orientation="left" 
                          stroke="#0EA5E9" 
                          axisLine={false} 
                          tickLine={false}
                          tickFormatter={(value: number) => `$${value}`}
                          tick={{ fill: 'oklch(0.55 0.04 260)', fontSize: 12 }}
                        />
                        <YAxis 
                          yAxisId="right" 
                          orientation="right" 
                          stroke="#14B8A6" 
                          axisLine={false} 
                          tickLine={false}
                          tickFormatter={(value: number) => `${value}%`}
                          tick={{ fill: 'oklch(0.55 0.04 260)', fontSize: 12 }}
                        />
                        <Tooltip 
                          cursor={{ fill: 'oklch(0.98 0.01 240)' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar 
                          yAxisId="left" 
                          dataKey="total_revenue" 
                          name="Revenue" 
                          fill="url(#colorRevenue)" 
                          radius={[6, 6, 0, 0]} 
                          barSize={48}
                        />
                        <Bar 
                          yAxisId="right" 
                          dataKey="conversion_rate" 
                          name="Conversion Rate" 
                          fill="#14B8A6" 
                          radius={[6, 6, 0, 0]} 
                          barSize={16}
                          opacity={0.8}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Provider Grid Filter */}
            <div className="flex items-center justify-between">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="search" 
                  placeholder="Search providers..." 
                  className="pl-9 bg-card border-border rounded-xl"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                 {/* View Toggles could go here */}
              </div>
            </div>

            {/* Provider Grid */}
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
            >
              <AnimatePresence mode="popLayout">
                {filteredProviders.map(provider => (
                  <ProviderCard 
                    key={provider.provider_id} 
                    provider={provider} 
                    maxRevenue={maxRevenue}
                  />
                ))}
              </AnimatePresence>
              
              {filteredProviders.length === 0 && (
                <div className="col-span-full py-12 text-center text-muted-foreground">
                  No providers found matching your search.
                </div>
              )}
            </motion.div>
      </div>

          {/* Right Column: Leaderboard (1/3 width) */}
          <div className="space-y-6">
            <Card className="border-border bg-card/80 shadow-sm backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Award className="h-5 w-5 text-yellow-500" />
                  Top Performers
                </CardTitle>
                <CardDescription>
                  Ranked by conversion rate
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-1 p-3 pt-0">
                {sortedByConversion.slice(0, 5).map((provider, i) => (
                  <LeaderboardRow 
                    key={provider.provider_id} 
                    provider={provider} 
                    rank={i + 1} 
                  />
                ))}
                
                {sortedByConversion.length > 5 && (
                  <Button variant="ghost" className="w-full mt-2 text-xs text-muted-foreground">
                    View All Rankings
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border border-sky-100 bg-gradient-to-br from-sky-50 to-white shadow-sm">
              <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-sky-100/50 blur-3xl" />
              <CardHeader>
                <CardTitle className="text-sky-900 flex items-center gap-2">
                  <Star className="h-4 w-4 text-sky-500 fill-sky-500" />
                  Pro Tip
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <p className="text-sky-800/80 text-sm leading-relaxed">
                  Providers with a satisfaction score above <span className="font-semibold text-sky-900">9.0</span> have a 40% higher retention rate. Consider coaching specifically for patient experience.
                </p>
                <Button variant="outline" size="sm" className="mt-4 border-sky-200 bg-white text-sky-700 hover:bg-sky-50 hover:text-sky-800 shadow-sm">
                  View Insights
                </Button>
          </CardContent>
        </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
