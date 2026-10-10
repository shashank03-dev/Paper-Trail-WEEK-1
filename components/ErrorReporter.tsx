"use client";
import { useEffect } from "react";
import { reportError } from "@/lib/client/report";

/** Reports uncaught errors and unhandled promise rejections to the server log. */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportError("runtime", e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => reportError("promise", e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
