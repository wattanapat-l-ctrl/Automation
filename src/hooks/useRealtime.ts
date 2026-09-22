"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

let channelSeq = 0;

export function useRealtime(
  tables: string[],
  pollMs = 7000
): { tick: number; live: boolean } {
  const [tick, setTick] = useState(0);
  const [live, setLive] = useState(false);
  const tablesKey = tables.join(",");
  const tablesRef = useRef(tables);

  useEffect(() => {
    tablesRef.current = tables;
  });

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;
    const currentTables = tablesRef.current;
    const instanceId = ++channelSeq;

    const timer = setInterval(() => {
      if (mounted) setTick((t) => t + 1);
    }, pollMs);

    const channels = currentTables.map((table) =>
      supabase
        .channel(`live-${table}-${instanceId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => {
            if (!mounted) return;
            setLive(true);
            setTick((t) => t + 1);
            window.clearTimeout(liveTimeout);
            liveTimeout = window.setTimeout(() => {
              if (mounted) setLive(false);
            }, 4000);
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED" && mounted) setLive(true);
        })
    );

    let liveTimeout = 0;

    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.clearTimeout(liveTimeout);
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [tablesKey, pollMs]);

  return { tick, live };
}