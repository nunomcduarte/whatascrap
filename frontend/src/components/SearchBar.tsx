"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") || "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      router.push(`/?${params.toString()}`);
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, router, searchParams]);

  return (
    <input
      type="text"
      placeholder="Search transcripts..."
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5
                 text-sm text-zinc-50 placeholder:text-zinc-600
                 focus:outline-none focus:border-zinc-700
                 transition-colors duration-200"
    />
  );
}
