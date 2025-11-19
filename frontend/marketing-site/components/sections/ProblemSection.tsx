import FadeInUp from "@/components/animations/FadeInUp";
import { PhoneOff, Clock, UserX } from "lucide-react";

export default function ProblemSection() {
  const problems = [
    {
      icon: PhoneOff,
      title: "Calls going to voicemail",
      description: "During rush hours, potential patients hang up when they can&apos;t reach a live person",
    },
    {
      icon: UserX,
      title: "Staff overwhelmed",
      description: "Your team is buried in repetitive booking questions instead of helping in-person clients",
    },
    {
      icon: Clock,
      title: "24/7 expectations",
      description: "Patients want to book at 9 PM on Sunday, but you&apos;re only available 9-5 weekdays",
    },
  ];

  return (
    <section className="section-spacing bg-white">
      <div className="container-wide">
        <FadeInUp className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="heading-lg text-gray-900 mb-4">
            Every Missed Call is Lost Revenue
          </h2>
          <p className="text-xl text-gray-600">
            The average medical spa loses <span className="font-bold text-primary-600">$50,000/year</span> to missed calls and inefficient scheduling.
          </p>
        </FadeInUp>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {problems.map((problem, index) => (
            <FadeInUp key={index} delay={index * 0.1}>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 text-red-600 rounded-2xl mb-6">
                  <problem.icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {problem.title}
                </h3>
                <p className="text-gray-600">
                  {problem.description}
                </p>
              </div>
            </FadeInUp>
          ))}
        </div>
      </div>
    </section>
  );
}
