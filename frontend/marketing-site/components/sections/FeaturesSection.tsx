import FadeInUp from "@/components/animations/FadeInUp";
import { FEATURES } from "@/lib/constants";
import { Phone, Calendar, MessageSquare, BarChart3, Zap, Activity, LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Phone,
  Calendar,
  MessageSquare,
  BarChart3,
  Zap,
  Activity,
};

export default function FeaturesSection() {
  return (
    <section className="section-spacing bg-white">
      <div className="container-wide">
        <FadeInUp className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="heading-lg text-gray-900 mb-4">
            Every Feature Your Front Desk Needs
          </h2>
          <p className="text-xl text-gray-600">
            Eva combines cutting-edge AI with practical features designed specifically for medical spas and aesthetic practices.
          </p>
        </FadeInUp>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((feature, index) => {
            const Icon = iconMap[feature.icon];
            return (
              <FadeInUp key={index} delay={index * 0.1}>
                <div className="card group hover:border-primary-200 transition-all duration-300 h-full">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-colors">
                      {Icon && <Icon className="w-6 h-6" />}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              </FadeInUp>
            );
          })}
        </div>
      </div>
    </section>
  );
}

