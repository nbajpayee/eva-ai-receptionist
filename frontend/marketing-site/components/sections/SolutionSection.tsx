import FadeInUp from "@/components/animations/FadeInUp";
import { Ear, Brain, Zap } from "lucide-react";

export default function SolutionSection() {
  const steps = [
    {
      icon: Ear,
      number: "01",
      title: "Listen",
      description: "Eva answers every call instantly with a warm, professional voice that puts patients at ease",
      color: "bg-blue-500",
    },
    {
      icon: Brain,
      number: "02",
      title: "Understand",
      description: "Natural language AI comprehends patient needs, questions, and booking preferences in real-time",
      color: "bg-purple-500",
    },
    {
      icon: Zap,
      number: "03",
      title: "Execute",
      description: "Books appointments, provides pricing, schedules follow-ups—automatically, with 100% reliability",
      color: "bg-green-500",
    },
  ];

  return (
    <section className="section-spacing bg-gradient-to-b from-gray-50 to-white">
      <div className="container-wide">
        <FadeInUp className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="heading-lg text-gray-900 mb-4">
            Meet Eva: Your Intelligent Front Desk
          </h2>
          <p className="text-xl text-gray-600">
            Eva doesn't just answer calls—she understands, engages, and converts every conversation into a positive patient experience.
          </p>
        </FadeInUp>

        <div className="max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <FadeInUp key={index} delay={index * 0.15}>
              <div className="relative">
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute left-12 top-24 w-0.5 h-32 bg-gradient-to-b from-gray-300 to-transparent" />
                )}

                <div className="flex flex-col md:flex-row items-start gap-6 mb-12">
                  {/* Icon & Number */}
                  <div className="flex-shrink-0">
                    <div className={`relative w-24 h-24 ${step.color} rounded-2xl flex items-center justify-center`}>
                      <step.icon className="w-12 h-12 text-white" />
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center text-gray-900 font-bold text-sm shadow-lg">
                        {step.number}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-2">
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                      {step.title}
                    </h3>
                    <p className="text-lg text-gray-600 max-w-2xl">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            </FadeInUp>
          ))}
        </div>
      </div>
    </section>
  );
}
