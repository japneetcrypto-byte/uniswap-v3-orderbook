"use client";

import { useState } from "react";

interface PoolAddressInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function PoolAddressInput({ value, onChange }: PoolAddressInputProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (value) {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="group">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Pool Address
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640"
          className="w-full px-4 py-3 pr-12 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-sm hover:border-blue-400 dark:hover:border-blue-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
        <button
          onClick={handleCopy}
          disabled={!value}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Copy address"
        >
          {copied ? (
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">Enter Uniswap V3 pool contract address</p>
    </div>
  );
}
