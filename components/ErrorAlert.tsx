"use client";

export function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <p className="text-red-800 font-medium">⚠️ Error</p>
      <p className="text-red-600 text-sm mt-1">{message}</p>
    </div>
  );
}
