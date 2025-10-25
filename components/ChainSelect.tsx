"use client";

interface ChainSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function ChainSelect({ value, onChange }: ChainSelectProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Chain
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
      >
        <option value="ethereum">Ethereum</option>
        <option value="base">Base</option>
        <option value="arbitrum">Arbitrum</option>
      </select>
    </div>
  );
}
