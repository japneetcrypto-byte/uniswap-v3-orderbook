"use client";

interface ModeToggleProps {
  mode: "simple" | "advanced";
  onChange: (mode: "simple" | "advanced") => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-300">
      <button
        onClick={() => onChange("simple")}
        className={`px-6 py-3 font-semibold transition-colors ${
          mode === "simple"
            ? "bg-blue-600 text-white"
            : "bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        Simple
      </button>
      <button
        onClick={() => onChange("advanced")}
        className={`px-6 py-3 font-semibold transition-colors ${
          mode === "advanced"
            ? "bg-blue-600 text-white"
            : "bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        Advanced
      </button>
    </div>
  );
}
