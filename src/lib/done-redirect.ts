import "server-only";
import { redirect } from "next/navigation";

/**
 * After an action that changes what the page shows (approve, reject, ...), go back to the page named in the
 * form's hidden "back" field with ?done=<kind>, so the page can confirm it. Only same-site paths are allowed.
 */
export function doneRedirect(fd: FormData, kind: string, extra: Record<string, string | number> = {}): void {
  const back = String(fd.get("back") ?? "");
  if (!back.startsWith("/") || back.startsWith("//")) return;
  const q = new URLSearchParams({ done: kind, ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])) });
  redirect(`${back.split("?")[0]}?${q}`);
}
