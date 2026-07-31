"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import {
  SupabaseProvider,
  type SupabasePersistenceOptions,
} from "@supabase-labs/y-supabase";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export type RealtimeFlowStatus = "connecting" | "connected" | "error";

type UseRealtimeFlowOptions = {
  channel: string;
  persistence?: boolean | SupabasePersistenceOptions;
  awareness?: boolean | Awareness;
  initialNodes?: Node[];
  initialEdges?: Edge[];
};

type SetStateAction<T> = T | ((previous: T) => T);

const INITIAL_SYNC_MS = 350;

function describeError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Supabase Realtime returned an unknown synchronization error.";
}

function parseSharedMap<T extends { id: string }>(
  map: Y.Map<string>,
  kind: "node" | "edge",
): T[] {
  const parsed: T[] = [];

  map.forEach((value, id) => {
    try {
      const item = JSON.parse(value) as T;
      if (!item || item.id !== id) {
        throw new Error(`Expected ${kind} id "${id}" in the synchronized payload.`);
      }
      parsed.push(item);
    } catch (error) {
      throw new Error(
        `Realtime ${kind} "${id}" is invalid. Reconnect to reload the shared workflow. ${describeError(error)}`,
      );
    }
  });

  return parsed;
}

export function useRealtimeFlow({
  channel,
  persistence,
  awareness = true,
  initialNodes = [],
  initialEdges = [],
}: UseRealtimeFlowOptions) {
  const [nodes, setNodesState] = useState<Node[]>([]);
  const [edges, setEdgesState] = useState<Edge[]>([]);
  const [status, setStatus] = useState<RealtimeFlowStatus>("connecting");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [reconnectKey, setReconnectKey] = useState(0);

  const docRef = useRef<Y.Doc | null>(null);
  const syncedRef = useRef(false);
  const initialNodesRef = useRef(initialNodes);
  const initialEdgesRef = useRef(initialEdges);

  useEffect(() => {
    const doc = new Y.Doc();
    const yNodes = doc.getMap<string>("nodes");
    const yEdges = doc.getMap<string>("edges");
    const initialNodesForChannel = initialNodesRef.current;
    const initialEdgesForChannel = initialEdgesRef.current;
    let initialSyncTimer: ReturnType<typeof setTimeout> | null = null;
    let hasRemoteActivity = false;

    setStatus("connecting");
    setSyncError(null);

    const provider = new SupabaseProvider(channel, doc, createClient(), {
      awareness,
      persistence,
    });

    const clearInitialSyncTimer = () => {
      if (initialSyncTimer) {
        clearTimeout(initialSyncTimer);
        initialSyncTimer = null;
      }
    };

    const failSync = (error: unknown) => {
      clearInitialSyncTimer();
      setStatus("error");
      setSyncError(
        `Workflow collaboration failed: ${describeError(error)} Check your connection, then reconnect.`,
      );
    };

    const syncFromYjs = () => {
      try {
        setNodesState(parseSharedMap<Node>(yNodes, "node"));
        setEdgesState(parseSharedMap<Edge>(yEdges, "edge"));
      } catch (error) {
        failSync(error);
      }
    };

    const seedInitialState = () => {
      doc.transact(() => {
        if (yNodes.size === 0) {
          for (const node of initialNodesForChannel) {
            yNodes.set(node.id, JSON.stringify(node));
          }
        }

        if (yEdges.size === 0) {
          for (const edge of initialEdgesForChannel) {
            yEdges.set(edge.id, JSON.stringify(edge));
          }
        }
      }, "local");
    };

    const nodesObserver = (event: Y.YMapEvent<string>) => {
      if (event.transaction.origin === "local") return;
      hasRemoteActivity = true;
      syncFromYjs();
    };

    const edgesObserver = (event: Y.YMapEvent<string>) => {
      if (event.transaction.origin === "local") return;
      hasRemoteActivity = true;
      syncFromYjs();
    };

    yNodes.observe(nodesObserver);
    yEdges.observe(edgesObserver);

    const markSynced = (shouldSeed = false) => {
      if (syncedRef.current) return;
      clearInitialSyncTimer();
      syncedRef.current = true;

      if (shouldSeed && !hasRemoteActivity) {
        seedInitialState();
      }

      syncFromYjs();
      setSyncError(null);
      setStatus("connected");
    };

    const persistenceInstance = provider.getPersistence();
    if (persistenceInstance) {
      if (persistenceInstance.synced) {
        markSynced();
      } else {
        persistenceInstance.on("synced", () => markSynced());
        persistenceInstance.on("error", failSync);
      }
    } else {
      provider.on("connect", () => {
        setSyncError(null);
        setStatus("connecting");
        clearInitialSyncTimer();
        initialSyncTimer = setTimeout(() => markSynced(true), INITIAL_SYNC_MS);
      });
      provider.on("message", () => {
        hasRemoteActivity = true;
        markSynced();
      });
      provider.on("disconnect", () => {
        if (syncedRef.current) setStatus("connecting");
      });
      provider.on("error", failSync);
    }

    docRef.current = doc;

    return () => {
      clearInitialSyncTimer();
      yNodes.unobserve(nodesObserver);
      yEdges.unobserve(edgesObserver);
      provider.destroy();
      doc.destroy();
      docRef.current = null;
      syncedRef.current = false;
    };
  }, [channel, awareness, persistence, reconnectKey]);

  const syncNodesToYjs = useCallback((updated: Node[]) => {
    const doc = docRef.current;
    if (!doc || !syncedRef.current) return;

    const yNodes = doc.getMap<string>("nodes");
    doc.transact(() => {
      const nextIds = new Set(updated.map((node) => node.id));
      for (const id of Array.from(yNodes.keys())) {
        if (!nextIds.has(id)) yNodes.delete(id);
      }
      for (const node of updated) {
        yNodes.set(node.id, JSON.stringify(node));
      }
    }, "local");
  }, []);

  const syncEdgesToYjs = useCallback((updated: Edge[]) => {
    const doc = docRef.current;
    if (!doc || !syncedRef.current) return;

    const yEdges = doc.getMap<string>("edges");
    doc.transact(() => {
      const nextIds = new Set(updated.map((edge) => edge.id));
      for (const id of Array.from(yEdges.keys())) {
        if (!nextIds.has(id)) yEdges.delete(id);
      }
      for (const edge of updated) {
        yEdges.set(edge.id, JSON.stringify(edge));
      }
    }, "local");
  }, []);

  const setNodes = useCallback(
    (nodesOrUpdater: SetStateAction<Node[]>) => {
      setNodesState((current) => {
        const updated =
          typeof nodesOrUpdater === "function"
            ? nodesOrUpdater(current)
            : nodesOrUpdater;
        syncNodesToYjs(updated);
        return updated;
      });
    },
    [syncNodesToYjs],
  );

  const setEdges = useCallback(
    (edgesOrUpdater: SetStateAction<Edge[]>) => {
      setEdgesState((current) => {
        const updated =
          typeof edgesOrUpdater === "function"
            ? edgesOrUpdater(current)
            : edgesOrUpdater;
        syncEdgesToYjs(updated);
        return updated;
      });
    },
    [syncEdgesToYjs],
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodesState((current) => {
      const updated = applyNodeChanges(changes, current);
      const doc = docRef.current;
      if (!doc || !syncedRef.current) return updated;

      const yNodes = doc.getMap<string>("nodes");
      doc.transact(() => {
        for (const change of changes) {
          if (change.type === "remove") {
            yNodes.delete(change.id);
          } else if (change.type === "add") {
            yNodes.set(change.item.id, JSON.stringify(change.item));
          } else {
            const node = updated.find((candidate) => candidate.id === change.id);
            if (node) yNodes.set(node.id, JSON.stringify(node));
          }
        }
      }, "local");

      return updated;
    });
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdgesState((current) => {
      const updated = applyEdgeChanges(changes, current);
      const doc = docRef.current;
      if (!doc || !syncedRef.current) return updated;

      const yEdges = doc.getMap<string>("edges");
      doc.transact(() => {
        for (const change of changes) {
          if (change.type === "remove") {
            yEdges.delete(change.id);
          } else if (change.type === "add") {
            yEdges.set(change.item.id, JSON.stringify(change.item));
          }
        }
      }, "local");

      return updated;
    });
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdgesState((current) => {
      const updated = addEdge(
        { ...connection, type: "smoothstep", animated: true },
        current,
      );
      const newEdge = updated.find(
        (edge) => !current.some((candidate) => candidate.id === edge.id),
      );

      if (newEdge) {
        const doc = docRef.current;
        if (doc && syncedRef.current) {
          doc.getMap<string>("edges").set(newEdge.id, JSON.stringify(newEdge));
        }
      }

      return updated;
    });
  }, []);

  const reconnect = useCallback(() => {
    setReconnectKey((current) => current + 1);
  }, []);

  return {
    nodes,
    edges,
    synced: status === "connected",
    status,
    syncError,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setNodes,
    setEdges,
    reconnect,
  };
}
