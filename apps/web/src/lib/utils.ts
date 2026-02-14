import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function confidenceLevel(score: number): "high" | "medium" | "low" {
  if (score > 0.9) return "high";
  if (score >= 0.7) return "medium";
  return "low";
}

export function confidenceColor(score: number): string {
  const level = confidenceLevel(score);
  switch (level) {
    case "high":
      return "text-confidence-high border-confidence-high";
    case "medium":
      return "text-confidence-medium border-confidence-medium";
    case "low":
      return "text-confidence-low border-confidence-low";
  }
}
