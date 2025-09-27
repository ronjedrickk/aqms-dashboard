// useRules.ts (custom hook)
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";

interface Rule {
  id: string;
  min: number;
  max: number;
  recommendation: string;
  severity: string;
}

interface RuleMap {
  [category: string]: Rule[];
}

export function useRules() {
  const [rules, setRules] = useState<RuleMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribes = ["AQI", "Heat", "UV"].map((category) => {
      return onSnapshot(
        collection(db, "categories", category, "thresholds"),
        (snap) => {
          const categoryRules = snap.docs.map(
            (doc: QueryDocumentSnapshot<DocumentData>) => ({
              id: doc.id,
              ...doc.data(),
            })
          ) as Rule[];

          setRules((prev) => ({
            ...prev,
            [category]: categoryRules,
          }));

          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, []);

  return { rules, loading };
}
