import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const wining_lines = ["damn, you're cooking!", "that's a W bro!", "Yo! that's huge W!"]
export const lose_lines = ["damn it, you're cooked!", "L, Better Luck Next Time", "Sorry bro, Not today but one day."]