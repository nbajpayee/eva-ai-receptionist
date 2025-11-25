"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PeriodSelector, PERIODS } from "@/components/period-selector";
import { EnhancedStatCard } from "@/components/dashboard/enhanced-stat-card";
import {
  Calendar,
  Check,
  Download,
  Users,
  Clock,
  MessageSquare,
  AlertCircle,
  Info,
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
  ChevronDown,
  Settings,
  Bell,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

export default function ComponentLibrary() {
  const [activeTab, setActiveTab] = useState("buttons");
  const [showModal, setShowModal] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [demoPeriod, setDemoPeriod] = useState<string>("today");

  return (
    <div className="space-y-12 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Component Library
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Living design system showcase for the Eva admin dashboard. Refine designs here before rolling out across the product UI.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-zinc-200">
        <nav className="flex gap-6 overflow-x-auto">
          {[
            { id: "layout", label: "Layout" },
            { id: "typography", label: "Typography" },
            { id: "buttons", label: "Buttons" },
            { id: "inputs", label: "Inputs & Forms" },
            { id: "cards", label: "Cards" },
            { id: "badges", label: "Badges & Pills" },
            { id: "modals", label: "Modals & Overlays" },
            { id: "tables", label: "Tables & Lists" },
            { id: "charts", label: "Charts & Data Viz" },
            { id: "feedback", label: "Feedback & States" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-sky-500 text-sky-600"
                  : "border-transparent text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="active-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500"
                />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Layout Section */}
      {activeTab === "layout" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          <Section
            title="Marketing Page Shell"
            description="Structure for marketing-style pages with hero and supporting sections"
          >
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-b from-white to-sky-50 shadow-sm">
                <div className="border-b border-zinc-200 bg-white/80 px-4 py-3 text-sm font-semibold text-zinc-900">
                  Top Navigation
                </div>
                <div className="space-y-4 px-4 py-5">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-sky-600">
                      Hero
                    </p>
                    <p className="text-lg font-semibold text-zinc-900">
                      AI reception for modern med-spas
                    </p>
                    <p className="text-xs text-zinc-500">
                      Center-aligned hero copy with supporting subheading and CTA row.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-zinc-200 bg-white/80 p-3">
                      <p className="text-xs font-medium text-zinc-700">Step cards</p>
                      <p className="mt-1 text-xs text-zinc-500">Explain the flow in 3 clear steps.</p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-white/80 p-3">
                      <p className="text-xs font-medium text-zinc-700">Social proof</p>
                      <p className="mt-1 text-xs text-zinc-500">Logos, testimonials, or stats.</p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-white/80 p-3">
                      <p className="text-xs font-medium text-zinc-700">Secondary CTA</p>
                      <p className="mt-1 text-xs text-zinc-500">Docs, demo video, or pricing.</p>
                    </div>
                  </div>
                </div>
                <div className="border-t border-zinc-200 bg-white/80 px-4 py-2 text-[11px] text-zinc-500">
                  Container: max-w-5xl • Padding: px-6 lg:px-10 • Vertical rhythm: py-10 lg:py-16
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="Dashboard Shell"
            description="Layout for the logged-in admin experience with sidebar and content area"
          >
            <div className="grid gap-4 md:grid-cols-[260px,1fr]">
              <div className="rounded-xl border border-zinc-200 bg-white/80 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Sidebar</p>
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex items-center justify-between rounded-lg bg-sky-50 px-3 py-2 text-sky-700">
                    <span>Overview</span>
                    <span className="text-[10px] font-semibold">Active</span>
                  </div>
                  <div className="rounded-lg px-3 py-2 text-zinc-600 hover:bg-zinc-50">
                    Calls
                  </div>
                  <div className="rounded-lg px-3 py-2 text-zinc-600 hover:bg-zinc-50">
                    Appointments
                  </div>
                  <div className="rounded-lg px-3 py-2 text-zinc-600 hover:bg-zinc-50">
                    Settings
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-200 bg-white/80 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Header
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">Overview</p>
                  <p className="text-xs text-zinc-500">Today&apos;s performance at a glance.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-500">
                    Stat cards row
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-500">
                    Chart + timeline
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-500">
                    Recent activity list
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="Section Blocks"
            description="Reusable sections for long-form marketing or docs pages"
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Section</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">How Eva works</p>
                <p className="text-xs text-zinc-500">
                  Use a clear H2, supporting body text, then a grid of 3–4 cards.
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-500">
                    Step 1
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-500">
                    Step 2
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-500">
                    Step 3
                  </div>
                </div>
              </div>
            </div>
          </Section>
        </motion.div>
      )}

      {/* Typography Section */}
      {activeTab === "typography" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          <Section
            title="Heading Hierarchy"
            description="Consistent H1–H3 stack for the Eva admin dashboard"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Page title (H1)
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900 lg:text-4xl">
                  AI reception that never misses a lead
                </h1>
                <p className="max-w-xl text-sm text-zinc-600 lg:text-base">
                  Eva answers every call, qualifies patients, and books directly into your EMR.
                </p>
                <p className="text-xs font-medium uppercase tracking-wide text-sky-600">
                  Built for med-spas · HIPAA-conscious · Voice-first
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Section heading (H2)
                  </p>
                  <h2 className="text-2xl font-semibold text-zinc-900 lg:text-3xl">
                    How Eva fits into your workflow
                  </h2>
                  <p className="text-sm text-zinc-600">
                    Use H2s to break up long pages into scannable sections.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Card title (H3)
                  </p>
                  <h3 className="text-lg font-semibold text-zinc-900 lg:text-xl">
                    Qualify callers automatically
                  </h3>
                  <p className="text-sm text-zinc-600">
                    Use H3s inside cards or subsections, keeping copy concise.
                  </p>
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="Body & Meta Text"
            description="Default body copy, helper text, and metadata styles in the admin dashboard"
          >
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Body copy
                </p>
                <p className="mt-1 max-w-xl text-sm text-zinc-700 lg:text-base">
                  Use this style for primary explanatory copy across the Eva admin dashboard.
                  Keep sentences short and clinical but warm.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Helper text
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Use this for supporting context below inputs or settings labels.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Meta / timestamp
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Updated 5 minutes ago · Last call: 2:37 PM
                  </p>
                </div>
              </div>
            </div>
          </Section>
        </motion.div>
      )}

      {/* Buttons Section */}
      {activeTab === "buttons" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          <Section title="Primary Buttons" description="Main call-to-action buttons with gradient">
            <div className="flex flex-wrap items-center gap-4">
              <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-teal-500 px-6 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition-all hover:shadow-xl hover:shadow-sky-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
                <Calendar className="h-4 w-4" />
                Book Appointment
              </button>
              <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-500 px-6 text-sm font-semibold text-white shadow-md shadow-sky-500/20 transition-all hover:bg-sky-600 hover:shadow-lg hover:shadow-sky-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
                Save Changes
              </button>
              <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-500 px-6 text-sm font-semibold text-white shadow-md shadow-teal-500/20 transition-all hover:bg-teal-600 hover:shadow-lg hover:shadow-teal-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
                <Check className="h-4 w-4" />
                Confirm
              </button>
            </div>
          </Section>

          <Section title="Secondary Buttons" description="Outlined buttons for secondary actions">
            <div className="flex flex-wrap items-center gap-4">
              <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-6 text-sm font-medium text-zinc-700 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300">
                Cancel
              </button>
              <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-sky-200 bg-white px-6 text-sm font-medium text-sky-600 shadow-sm transition-all hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </Section>

          <Section title="Ghost Buttons" description="Text-only buttons for tertiary actions">
            <div className="flex flex-wrap items-center gap-4">
              <button className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300">
                View Details
              </button>
              <button className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-sky-600 transition-colors hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
                <Settings className="h-4 w-4" />
                Settings
              </button>
            </div>
          </Section>

          <Section title="Icon Buttons" description="Square buttons with icons only">
            <div className="flex flex-wrap items-center gap-4">
              <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-zinc-200 text-zinc-600 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300">
                <Search className="h-4 w-4" />
              </button>
              <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500 text-white shadow-md shadow-sky-500/20 transition-all hover:bg-sky-600 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
                <Bell className="h-4 w-4" />
              </button>
              <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-teal-500 text-white shadow-lg shadow-sky-500/20 transition-all hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
                <Sparkles className="h-4 w-4" />
              </button>
            </div>
          </Section>

          <Section title="Button Sizes" description="Different size variants">
            <div className="flex flex-wrap items-center gap-4">
              <button className="inline-flex h-8 items-center gap-1.5 rounded-md bg-sky-500 px-3 text-xs font-semibold text-white shadow-sm transition-all hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                Small
              </button>
              <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-500 px-6 text-sm font-semibold text-white shadow-md transition-all hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
                Default
              </button>
              <button className="inline-flex h-12 items-center gap-2 rounded-lg bg-sky-500 px-8 text-base font-semibold text-white shadow-lg transition-all hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
                Large
              </button>
            </div>
          </Section>
        </motion.div>
      )}

      {/* Inputs & Forms Section */}
      {activeTab === "inputs" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          <Section title="Text Inputs" description="Standard text input fields">
            <div className="max-w-md space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Label
                </label>
                <input
                  type="text"
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  placeholder="Enter text..."
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  With Icon
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    placeholder="Search..."
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Disabled
                </label>
                <input
                  type="text"
                  disabled
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-400 cursor-not-allowed"
                  placeholder="Disabled input"
                />
              </div>
            </div>
          </Section>

          <Section title="Select Dropdowns" description="Dropdown select fields">
            <div className="max-w-md space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Select Option
                </label>
                <div className="relative">
                  <select className="h-10 w-full appearance-none rounded-lg border border-zinc-200 bg-white px-4 pr-10 text-sm text-zinc-900 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20">
                    <option>Option 1</option>
                    <option>Option 2</option>
                    <option>Option 3</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                </div>
              </div>
            </div>
          </Section>

          <Section title="Checkboxes & Radio Buttons" description="Selection controls">
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-700">Checkboxes</p>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300 text-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-zinc-700">Option 1</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4 rounded border-zinc-300 text-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-zinc-700">Option 2 (Checked)</span>
                </label>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-700">Radio Buttons</p>
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="radio-demo"
                    className="h-4 w-4 border-zinc-300 text-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-zinc-700">Choice A</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="radio-demo"
                    defaultChecked
                    className="h-4 w-4 border-zinc-300 text-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-zinc-700">Choice B (Selected)</span>
                </label>
              </div>
            </div>
          </Section>

          <Section
            title="Validation States"
            description="Standard error, success, and disabled styles for form fields"
          >
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Default
                </p>
                <div className="space-y-1.5">
                  <label
                    className="block text-sm font-medium text-zinc-700"
                    htmlFor="email-default"
                  >
                    Email address
                  </label>
                  <input
                    id="email-default"
                    type="email"
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    placeholder="you@example.com"
                  />
                  <p className="text-xs text-zinc-500">
                    We&apos;ll only use this for appointment updates.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-red-600">
                  Error
                </p>
                <div className="space-y-1.5">
                  <label
                    className="block text-sm font-medium text-zinc-700"
                    htmlFor="phone-error"
                  >
                    Phone number
                  </label>
                  <input
                    id="phone-error"
                    type="tel"
                    className="h-10 w-full rounded-lg border border-red-300 bg-white px-4 text-sm text-red-900 placeholder:text-red-300 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    placeholder="(555) 123-4567"
                  />
                  <p className="text-xs text-red-600">
                    Enter a valid phone number so we can confirm appointments.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                  Success & Disabled
                </p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label
                      className="block text-sm font-medium text-zinc-700"
                      htmlFor="name-success"
                    >
                      Patient name
                    </label>
                    <input
                      id="name-success"
                      type="text"
                      defaultValue="Alex Smith"
                      className="h-10 w-full rounded-lg border border-emerald-300 bg-white px-4 text-sm text-emerald-900 placeholder:text-emerald-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <p className="text-xs text-emerald-600">
                      Looks good. We&apos;ll use this on appointment details.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-zinc-700">
                      EMR-synced field
                    </label>
                    <input
                      type="text"
                      disabled
                      className="h-10 w-full cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-400"
                      value="Synced from EMR"
                      aria-disabled="true"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Section>
        </motion.div>
      )}

      {/* Cards Section */}
      {activeTab === "cards" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          <Section title="Standard Cards" description="Basic card containers">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <h3 className="text-lg font-semibold text-zinc-900">Card Title</h3>
                <p className="mt-2 text-sm text-zinc-600">
                  This is a standard card with border, shadow, and hover effect.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-zinc-900">With Icon</h3>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50">
                    <Users className="h-5 w-5 text-sky-600" />
                  </div>
                </div>
                <p className="text-sm text-zinc-600">Card with an icon in the header.</p>
              </div>
            </div>
          </Section>

          <Section
            title="Stat Cards"
            description="Dashboard metric cards using the EnhancedStatCard component"
          >
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <EnhancedStatCard
                title="Appointments Booked"
                value={128}
                icon={<Calendar className="h-5 w-5 text-primary" />}
                trend={{ value: 12, label: "vs last week", direction: "up" }}
                sparklineData={[{ value: 8 }, { value: 10 }, { value: 12 }, { value: 15 }, { value: 14 }, { value: 18 }, { value: 20 }]}
                color="primary"
                description="Booked directly by Eva"
              />
              <EnhancedStatCard
                title="Customers Engaged"
                value={567}
                icon={<Users className="h-5 w-5 text-secondary" />}
                trend={{ value: 8, label: "vs last week", direction: "up" }}
                sparklineData={[{ value: 30 }, { value: 32 }, { value: 31 }, { value: 35 }, { value: 38 }, { value: 40 }, { value: 42 }]}
                color="success"
                description="New and returning"
              />
              <EnhancedStatCard
                title="Call Minutes Saved"
                value={245}
                icon={<Clock className="h-5 w-5 text-amber-600" />}
                trend={{ value: 3, label: "vs last week", direction: "up" }}
                sparklineData={[{ value: 20 }, { value: 22 }, { value: 25 }, { value: 27 }, { value: 26 }, { value: 29 }, { value: 31 }]}
                color="warning"
                description="Automated by Eva"
              />
              <EnhancedStatCard
                title="Messages Sent"
                value={2891}
                icon={<MessageSquare className="h-5 w-5 text-accent" />}
                trend={{ value: 2, label: "vs last week", direction: "down" }}
                sparklineData={[{ value: 40 }, { value: 42 }, { value: 41 }, { value: 39 }, { value: 38 }, { value: 37 }, { value: 36 }]}
                color="info"
                description="SMS and email"
              />
            </div>
          </Section>

          <Section title="Glass Cards" description="Frosted glass morphism cards">
            <div className="rounded-3xl bg-gradient-to-br from-sky-500/20 via-teal-500/10 to-zinc-900/10 p-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-white/40 bg-white/15 p-6 shadow-xl shadow-sky-500/25 backdrop-blur-2xl">
                  <h3 className="text-lg font-semibold text-zinc-900">Glass Card</h3>
                  <p className="mt-2 text-sm text-zinc-700">
                    High-emphasis glass panel for primary metrics or overview cards.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/30 bg-white/10 p-6 shadow-lg shadow-zinc-900/20 backdrop-blur-xl">
                  <h3 className="text-lg font-semibold text-zinc-900">Glass Subtle</h3>
                  <p className="mt-2 text-sm text-zinc-700">
                    Softer glass treatment for secondary or supporting content.
                  </p>
                </div>
              </div>
            </div>
          </Section>
        </motion.div>
      )}

      {/* Badges Section */}
      {activeTab === "badges" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          <Section title="Status Badges" description="Semantic status indicators">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/10">
                <CheckCircle2 className="h-3 w-3" />
                Success
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-600/10">
                <AlertTriangle className="h-3 w-3" />
                Warning
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-red-600/10">
                <AlertCircle className="h-3 w-3" />
                Error
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-600/10">
                <Info className="h-3 w-3" />
                Info
              </span>
            </div>
          </Section>

          <Section title="Colored Badges" description="Brand color variants">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                Sky
              </span>
              <span className="inline-flex items-center rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700">
                Teal
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Emerald
              </span>
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                Neutral
              </span>
            </div>
          </Section>

          <Section title="Pill Badges" description="Small count indicators">
            <div className="flex flex-wrap items-center gap-4">
              <div className="inline-flex items-center gap-2">
                <span className="text-sm text-zinc-700">Notifications</span>
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-500 px-1.5 text-xs font-bold text-white">
                  3
                </span>
              </div>
              <div className="inline-flex items-center gap-2">
                <span className="text-sm text-zinc-700">Messages</span>
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                  12
                </span>
              </div>
            </div>
          </Section>
        </motion.div>
      )}

      {/* Modals Section */}
      {activeTab === "modals" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          <Section title="Modal Dialog" description="Overlay dialog patterns">
            <div>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-500 px-6 text-sm font-semibold text-white shadow-md transition-all hover:bg-sky-600"
              >
                Open Modal
              </button>
            </div>
          </Section>

          <Section title="Tooltips" description="Contextual hover information">
            <div className="relative inline-block">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-6 text-sm font-medium text-zinc-700 shadow-sm"
              >
                Hover Me
              </button>
              {showTooltip && (
                <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/30 bg-zinc-900/90 px-3 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
                  This is a tooltip
                </div>
              )}
            </div>
          </Section>

          <Section title="Dropdown Menus" description="Action menus and context menus">
            <div className="relative inline-block">
              <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-sm transition-all hover:bg-zinc-50">
                <MoreVertical className="h-4 w-4" />
              </button>
              <div className="mt-2 w-48 rounded-lg border border-zinc-200 bg-white shadow-lg">
                <div className="p-1">
                  <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100">
                    <Eye className="h-4 w-4 text-zinc-400" />
                    View Details
                  </button>
                  <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100">
                    <Edit className="h-4 w-4 text-zinc-400" />
                    Edit
                  </button>
                  <hr className="my-1 border-zinc-200" />
                  <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </Section>
        </motion.div>
      )}

      {/* Tables Section */}
      {activeTab === "tables" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          <Section title="Data Table" description="Sortable table with actions">
            <div className="overflow-hidden">
              <div className="mb-4 flex items-center justify-between">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search customers..."
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
                <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition-all hover:bg-zinc-50">
                  <Filter className="h-4 w-4" />
                  Filter
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="px-4 py-3 text-left">
                        <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-600 hover:text-zinc-900">
                          Customer
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-600 hover:text-zinc-900">
                          Status
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-600 hover:text-zinc-900">
                          Last Contact
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                          Actions
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    <tr className="transition-colors hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
                            JD
                          </div>
                          <div>
                            <div className="font-medium text-zinc-900">Jane Doe</div>
                            <div className="text-sm text-zinc-500">jane@example.com</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/10">
                          Active
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        2 hours ago
                      </td>
                      <td className="px-4 py-3">
                        <button className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                    <tr className="transition-colors hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
                            RS
                          </div>
                          <div>
                            <div className="font-medium text-zinc-900">Robert Smith</div>
                            <div className="text-sm text-zinc-500">robert@example.com</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-600/10">
                          Pending
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        1 day ago
                      </td>
                      <td className="px-4 py-3">
                        <button className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                    <tr className="transition-colors hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-700">
                            MJ
                          </div>
                          <div>
                            <div className="font-medium text-zinc-900">Maria Johnson</div>
                            <div className="text-sm text-zinc-500">maria@example.com</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-600/10">
                          Inactive
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        3 days ago
                      </td>
                      <td className="px-4 py-3">
                        <button className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4">
                <p className="text-sm text-zinc-600">
                  Showing <span className="font-medium">1-3</span> of <span className="font-medium">47</span> results
                </p>
                <div className="flex items-center gap-2">
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 transition-all hover:bg-zinc-50 hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-500 bg-sky-50 text-sm font-semibold text-sky-600">
                    1
                  </button>
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-600 transition-all hover:bg-zinc-50">
                    2
                  </button>
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-600 transition-all hover:bg-zinc-50">
                    3
                  </button>
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition-all hover:bg-zinc-50 hover:text-zinc-900">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </Section>

          <Section title="List Items" description="Alternative to tables for simpler data">
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 transition-all hover:border-zinc-300 hover:shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500">
                    <Phone className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-zinc-900">Voice Call</h4>
                    <p className="text-sm text-zinc-500">Customer inquiry about Botox pricing</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-zinc-500">2 min ago</span>
                  <button className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600">
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 transition-all hover:border-zinc-300 hover:shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500">
                    <MessageSquare className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-zinc-900">SMS Message</h4>
                    <p className="text-sm text-zinc-500">Appointment confirmation sent</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-zinc-500">15 min ago</span>
                  <button className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600">
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 transition-all hover:border-zinc-300 hover:shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-zinc-900">Email</h4>
                    <p className="text-sm text-zinc-500">Follow-up email with aftercare instructions</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-zinc-500">1 hour ago</span>
                  <button className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600">
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </Section>
        </motion.div>
      )}

      {/* Charts Section */}
      {activeTab === "charts" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          <Section title="Metric Cards with Trends" description="Stats with visual trend indicators">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-600">Total Revenue</p>
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-zinc-900">$24,560</p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <TrendingUp className="h-3 w-3" />
                    12%
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">vs last month</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-600">New Customers</p>
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-zinc-900">142</p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <TrendingUp className="h-3 w-3" />
                    8%
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">vs last month</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-600">Conversion Rate</p>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-zinc-900">3.2%</p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                    <TrendingDown className="h-3 w-3" />
                    2%
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">vs last month</p>
              </div>
            </div>
          </Section>

          <Section
            title="Time Range Selector"
            description="Pill-based period toggle used in dashboard headers (Today, Week, Month)"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <PeriodSelector selectedPeriod={demoPeriod} onPeriodChange={setDemoPeriod} periods={PERIODS} />
              <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-xs text-zinc-600 md:max-w-xs">
                <p className="font-medium text-zinc-800">Usage</p>
                <p className="mt-1">
                  Place this selector in page headers or chart toolbars to switch between time
                  ranges.
                </p>
                <p className="mt-2 text-[11px] text-zinc-500">
                  Current period: <span className="font-semibold text-zinc-900">{PERIODS.find((p) => p.value === demoPeriod)?.label}</span>
                </p>
              </div>
            </div>
          </Section>

          <Section title="Simple Bar Chart" description="Visual representation with bars">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-24 text-sm font-medium text-zinc-700">Botox</span>
                <div className="flex-1">
                  <div className="h-8 rounded-lg bg-zinc-100">
                    <div className="h-full w-[85%] rounded-lg bg-gradient-to-r from-sky-500 to-teal-500" />
                  </div>
                </div>
                <span className="w-16 text-right text-sm font-semibold text-zinc-900">234</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-24 text-sm font-medium text-zinc-700">Fillers</span>
                <div className="flex-1">
                  <div className="h-8 rounded-lg bg-zinc-100">
                    <div className="h-full w-[65%] rounded-lg bg-gradient-to-r from-sky-500 to-teal-500" />
                  </div>
                </div>
                <span className="w-16 text-right text-sm font-semibold text-zinc-900">178</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-24 text-sm font-medium text-zinc-700">Laser</span>
                <div className="flex-1">
                  <div className="h-8 rounded-lg bg-zinc-100">
                    <div className="h-full w-[45%] rounded-lg bg-gradient-to-r from-sky-500 to-teal-500" />
                  </div>
                </div>
                <span className="w-16 text-right text-sm font-semibold text-zinc-900">123</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-24 text-sm font-medium text-zinc-700">Facials</span>
                <div className="flex-1">
                  <div className="h-8 rounded-lg bg-zinc-100">
                    <div className="h-full w-[30%] rounded-lg bg-gradient-to-r from-sky-500 to-teal-500" />
                  </div>
                </div>
                <span className="w-16 text-right text-sm font-semibold text-zinc-900">82</span>
              </div>
            </div>
          </Section>

          <Section title="Progress Indicators" description="Progress bars and circular progress">
            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-700">Appointments Booked</span>
                  <span className="text-sm font-semibold text-zinc-900">75%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full w-[75%] rounded-full bg-gradient-to-r from-sky-500 to-teal-500" />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-700">Customer Satisfaction</span>
                  <span className="text-sm font-semibold text-zinc-900">92%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full w-[92%] rounded-full bg-emerald-500" />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-700">Response Time</span>
                  <span className="text-sm font-semibold text-zinc-900">45%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full w-[45%] rounded-full bg-amber-500" />
                </div>
              </div>
            </div>
          </Section>
        </motion.div>
      )}

      {/* Feedback Section */}
      {activeTab === "feedback" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          <Section title="Alert Boxes" description="Contextual feedback messages">
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <h4 className="text-sm font-semibold text-emerald-900">Success</h4>
                  <p className="mt-1 text-sm text-emerald-700">
                    Your changes have been saved successfully.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <h4 className="text-sm font-semibold text-amber-900">Warning</h4>
                  <p className="mt-1 text-sm text-amber-700">
                    Please review the information before proceeding.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                <div>
                  <h4 className="text-sm font-semibold text-red-900">Error</h4>
                  <p className="mt-1 text-sm text-red-700">
                    There was an error processing your request.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4">
                <Info className="h-5 w-5 shrink-0 text-sky-600" />
                <div>
                  <h4 className="text-sm font-semibold text-sky-900">Information</h4>
                  <p className="mt-1 text-sm text-sky-700">
                    This feature is currently in beta testing.
                  </p>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Loading States" description="Progress and loading indicators">
            <div className="flex flex-wrap items-center gap-6">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-sky-500" />
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
                <div className="h-2 w-2 animate-pulse rounded-full bg-sky-500 [animation-delay:0.2s]" />
                <div className="h-2 w-2 animate-pulse rounded-full bg-sky-500 [animation-delay:0.4s]" />
              </div>
            </div>
          </Section>
        </motion.div>
      )}

      {/* Modal Implementation */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-zinc-900">Modal Title</h2>
                <p className="mt-2 text-sm text-zinc-600">
                  This is an example modal dialog. Click outside or press the close button to
                  dismiss.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-6 text-sm font-medium text-zinc-700 shadow-sm transition-all hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-500 px-6 text-sm font-semibold text-white shadow-md transition-all hover:bg-sky-600"
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// Section wrapper component
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-6">{children}</div>
    </div>
  );
}
