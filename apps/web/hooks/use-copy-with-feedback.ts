"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { copyToClipboard } from "@/lib/clipboard";

/**
 * Hook for copying text with visual feedback and automatic cleanup.
 */
export function useCopyWithFeedback(feedbackDuration = 2000) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const copy = useCallback(
    async (text: string, key = "default") => {
      const success = await copyToClipboard(text);
      if (success) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setCopiedKey(key);
        timeoutRef.current = setTimeout(() => setCopiedKey(null), feedbackDuration);
      }
      return success;
    },
    [feedbackDuration]
  );

  const isCopied = useCallback((key = "default") => copiedKey === key, [copiedKey]);

  return { copy, isCopied, copiedKey };
}
