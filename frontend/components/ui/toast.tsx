"use client";
import { useState, useEffect } from 'react';

export function Toast({ message, onClose }: { message: string, onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-blue-600 text-white rounded-lg shadow-lg z-50">
      {message}
    </div>
  );
}

// Simple toast utility for quick notifications
export const toast = {
  success: (msg: string) => alert(msg),
  error: (msg: string) => alert(msg),
};
