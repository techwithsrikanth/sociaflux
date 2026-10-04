"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Application, ApplicationStatus, Campaign } from "./marketplace";
import type { CreatorProfile } from "./types";

/**
 * Server-backed marketplace state.
 *
 * Campaigns, applications and the creator directory live in the database, so
 * a brand and a creator in different browsers see the same board. Per-browser
 * things (drafts, filters, which handle is signed in) stay in localStorage.
 *
 * Writes are optimistic: local state updates immediately, the request follows,
 * and the server's version replaces the optimistic one when it lands.
 */

export type SyncStatus = "loading" | "ready" | "error";

/** Creator edits fire on every keystroke, so the write is debounced. */
const CREATOR_SAVE_DEBOUNCE_MS = 800;

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init?.headers } : init?.headers
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error || `Request failed (${response.status})`);
  return body as T;
}

export function useMarketplace() {
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCreator = useRef<CreatorProfile | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [creatorData, campaignData, applicationData] = await Promise.all([
        requestJson<{ creators: CreatorProfile[] }>("/api/creators"),
        requestJson<{ campaigns: Campaign[] }>("/api/campaigns"),
        requestJson<{ applications: Application[] }>("/api/applications")
      ]);
      setCreators(creatorData.creators || []);
      setCampaigns(campaignData.campaigns || []);
      setApplications(applicationData.applications || []);
      setStatus("ready");
      setError(null);
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Could not reach the database.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Writes a creator profile through, replacing the local copy with the stored one. */
  const persistCreator = useCallback(async (profile: CreatorProfile) => {
    try {
      const { creator } = await requestJson<{ creator: CreatorProfile }>("/api/creators", {
        method: "POST",
        body: JSON.stringify({ creator: profile })
      });
      setCreators((current) => [creator, ...current.filter((item) => item.handle !== creator.handle)]);
      setError(null);
      return creator;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the creator profile.");
      return profile;
    }
  }, []);

  /** Optimistic local update now, debounced write to the database. */
  const saveCreator = useCallback((profile: CreatorProfile, options: { immediate?: boolean } = {}) => {
    if (!profile.handle) return;
    setCreators((current) => [profile, ...current.filter((item) => item.handle !== profile.handle)]);

    if (options.immediate) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
      pendingCreator.current = null;
      void persistCreator(profile);
      return;
    }

    pendingCreator.current = profile;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const queued = pendingCreator.current;
      pendingCreator.current = null;
      saveTimer.current = null;
      if (queued) void persistCreator(queued);
    }, CREATOR_SAVE_DEBOUNCE_MS);
  }, [persistCreator]);

  // Do not lose an in-flight edit when the workspace unmounts.
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const queued = pendingCreator.current;
    if (queued) void persistCreator(queued);
  }, [persistCreator]);

  const postCampaign = useCallback(async (campaign: Campaign) => {
    setCampaigns((current) => [campaign, ...current.filter((item) => item.id !== campaign.id)]);
    try {
      const saved = await requestJson<{ campaign: Campaign }>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify(campaign)
      });
      setCampaigns((current) => [saved.campaign, ...current.filter((item) => item.id !== saved.campaign.id)]);
      setError(null);
      return saved.campaign;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not post the campaign.");
      return campaign;
    }
  }, []);

  const applyToCampaign = useCallback(async (application: Application) => {
    setApplications((current) => [
      application,
      ...current.filter((item) => !(item.campaignId === application.campaignId && item.creatorHandle === application.creatorHandle))
    ]);
    try {
      const saved = await requestJson<{ application: Application }>("/api/applications", {
        method: "POST",
        body: JSON.stringify({ application })
      });
      // The server keeps the original row id when re-applying, so swap on both keys.
      setApplications((current) => [
        saved.application,
        ...current.filter((item) =>
          item.id !== saved.application.id &&
          !(item.campaignId === saved.application.campaignId && item.creatorHandle === saved.application.creatorHandle))
      ]);
      setError(null);
      return saved.application;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send the application.");
      return application;
    }
  }, []);

  const withdrawApplication = useCallback(async (id: string) => {
    const previous = applications;
    setApplications((current) => current.filter((item) => item.id !== id));
    try {
      await requestJson(`/api/applications/${id}`, { method: "DELETE" });
      setError(null);
    } catch (cause) {
      setApplications(previous);
      setError(cause instanceof Error ? cause.message : "Could not withdraw the application.");
    }
  }, [applications]);

  const decideApplication = useCallback(async (id: string, nextStatus: ApplicationStatus) => {
    const previous = applications;
    setApplications((current) => current.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)));
    try {
      const saved = await requestJson<{ application: Application }>(`/api/applications/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus })
      });
      setApplications((current) => current.map((item) => (item.id === id ? saved.application : item)));
      setError(null);
    } catch (cause) {
      setApplications(previous);
      setError(cause instanceof Error ? cause.message : "Could not update the application.");
    }
  }, [applications]);

  return useMemo(
    () => ({
      creators,
      campaigns,
      applications,
      status,
      error,
      refresh,
      saveCreator,
      postCampaign,
      applyToCampaign,
      withdrawApplication,
      decideApplication
    }),
    [creators, campaigns, applications, status, error, refresh, saveCreator, postCampaign, applyToCampaign, withdrawApplication, decideApplication]
  );
}
