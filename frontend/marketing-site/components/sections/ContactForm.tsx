"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const contactFormSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  practiceName: z.string().min(2, "Practice name must be at least 2 characters"),
  locations: z.string(),
  message: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

export default function ContactForm() {
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
  });

  const onSubmit = async (data: ContactFormData) => {
    setSubmitStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to submit form");
      }

      const result = await response.json();
      setSubmitStatus("success");
      reset();

      // Reset success message after 5 seconds
      setTimeout(() => {
        setSubmitStatus("idle");
      }, 5000);
    } catch (error) {
      setSubmitStatus("error");
      setErrorMessage("Something went wrong. Please try again or contact us directly.");
    }
  };

  if (submitStatus === "success") {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8">
        <div className="text-center py-12">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Thank You!
          </h3>
          <p className="text-gray-600">
            We've received your demo request. Our team will contact you within 24 hours.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8" id="demo-form">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Schedule a Demo
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
              First Name *
            </label>
            <input
              type="text"
              id="firstName"
              {...register("firstName")}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.firstName ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.firstName && (
              <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
              Last Name *
            </label>
            <input
              type="text"
              id="lastName"
              {...register("lastName")}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.lastName ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.lastName && (
              <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email *
          </label>
          <input
            type="email"
            id="email"
            {...register("email")}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.email ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
            Phone *
          </label>
          <input
            type="tel"
            id="phone"
            {...register("phone")}
            placeholder="(555) 123-4567"
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.phone ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="practiceName" className="block text-sm font-medium text-gray-700 mb-2">
            Practice Name *
          </label>
          <input
            type="text"
            id="practiceName"
            {...register("practiceName")}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.practiceName ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.practiceName && (
            <p className="mt-1 text-sm text-red-600">{errors.practiceName.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="locations" className="block text-sm font-medium text-gray-700 mb-2">
            Number of Locations
          </label>
          <select
            id="locations"
            {...register("locations")}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="1">1</option>
            <option value="2-3">2-3</option>
            <option value="4-10">4-10</option>
            <option value="10+">10+</option>
          </select>
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
            Message (Optional)
          </label>
          <textarea
            id="message"
            {...register("message")}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Tell us about your practice and what you're looking for..."
          />
        </div>

        {submitStatus === "error" && (
          <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitStatus === "loading"}
          className="w-full btn-primary py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {submitStatus === "loading" ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            "Schedule Demo"
          )}
        </button>

        <p className="text-xs text-gray-600 text-center">
          By submitting this form, you agree to our Privacy Policy and Terms of Service.
        </p>
      </form>
    </div>
  );
}
