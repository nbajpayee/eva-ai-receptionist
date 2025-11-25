import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function InsightCards() {
  const insights = [
    {
      title: "Satisfaction Rising",
      description: "Customer satisfaction is up 12% this week due to faster pickup times.",
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
    },
    {
      title: "Peak Call Times",
      description: "Highest call volume observed between 2 PM - 4 PM on Tuesdays.",
      icon: Clock,
      color: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
    },
    {
      title: "High Conversion Service",
      description: "Botox inquiries are converting at 85%, the highest of all services.",
      icon: Sparkles,
      color: "text-secondary",
      bg: "bg-secondary/10",
      border: "border-secondary/20",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {insights.map((insight, index) => (
        <motion.div
          key={insight.title}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
        >
          <Card className={`border ${insight.border} ${insight.bg} shadow-sm`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`rounded-full p-2 bg-white/60 ${insight.color}`}>
                  <insight.icon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className={`text-sm font-semibold ${insight.color}`}>
                    {insight.title}
                  </h4>
                  <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
                    {insight.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}


