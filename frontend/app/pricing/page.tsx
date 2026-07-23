"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

const plans = [
  { name: "Free", price: "$0", features: ["Basic monitoring", "Community support"] },
  { name: "Pro", price: "$29", features: ["Advanced monitoring", "Priority support", "API access"] },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4 sm:p-6 flex flex-col items-center">
      <h1 className="text-3xl sm:text-4xl font-bold mb-8 sm:mb-12">Pricing Plans</h1>
      <div className="grid md:grid-cols-2 gap-6 sm:gap-8 w-full max-w-4xl">
        {plans.map((plan) => (
          <motion.div 
            key={plan.name}
            whileHover={{ y: -10 }}
            className="bg-neutral-900 border border-white/10 p-6 sm:p-8 rounded-3xl"
          >
            <h2 className="text-xl sm:text-2xl font-bold">{plan.name}</h2>
            <p className="text-3xl sm:text-4xl font-bold my-4">{plan.price}<span className="text-sm font-normal text-neutral-500">/mo</span></p>
            <ul className="space-y-4 mb-8">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm sm:text-base"><Check className="text-indigo-500 shrink-0" size={18} /> {f}</li>
              ))}
            </ul>
            <button className="w-full py-3 bg-indigo-600 rounded-xl font-bold text-sm sm:text-base">Get Started</button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
