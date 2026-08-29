"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";

type Device = {
  label: string;
  username: string;
  active: boolean;
  last_seen_at: string | null;
  created_at: string;
};

type Credentials = {
  endpoint: string;
  username: string;
  password: string;
};

function lastSeenText(value: string | null | undefined) {
  if (!value) return "Waiting for the first phone check-in";
  return `Last phone check-in ${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))}`;
}

function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="android-credential">
      <span>{label}</span>
      <code>{value}</code>
      <button type="button" onClick={copy} aria-label={`Copy ${label}`}>
        <Copy size={15} />{copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function AndroidTrackingSetup() {
  const [device, setDevice] = useState<Device | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/android-tracking/device", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load Android tracking.");
        if (!cancelled) setDevice(body.device);
      })
      .catch((error) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Could not load Android tracking.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function createConnection() {
    if (device?.active && !window.confirm("Replace the current Android connection key? OwnTracks will stop reporting until its password is updated.")) {
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/android-tracking/device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Android phone" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not create the Android connection.");
      setDevice(body.device);
      setCredentials(body.credentials);
      setMessage("Connection created. The password is shown only on this screen—finish OwnTracks setup before leaving.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create the Android connection.");
    } finally {
      setBusy(false);
    }
  }

  async function disableConnection() {
    if (!window.confirm("Disable Android background time capture?")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/android-tracking/device", { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not disable Android tracking.");
      setDevice((current) => current ? { ...current, active: false } : null);
      setCredentials(null);
      setMessage("Android background time capture is disabled.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not disable Android tracking.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel android-tracking" id="android-tracking">
      <div className="panel-heading">
        <div><span className="eyebrow">Android automation</span><h2>Background jobsite time</h2></div>
        <Smartphone />
      </div>

      <div className="android-tracking-status">
        <ShieldCheck size={18} />
        <div>
          <strong>{device?.active ? "Secure phone connection active" : "Connect your Android phone"}</strong>
          <span>{loading ? "Checking connection…" : lastSeenText(device?.last_seen_at)}</span>
        </div>
      </div>

      <p>
        OwnTracks reports jobsite arrivals and departures over encrypted HTTPS. Buildr keeps the event times—not a continuous location trail—and creates a duplicate-safe time entry after departure.
      </p>

      <div className="button-row">
        <button className="button button--gold" type="button" onClick={createConnection} disabled={busy || loading}>
          <RefreshCw size={16} />{device?.active ? "Replace connection key" : "Create phone connection"}
        </button>
        {device?.active && (
          <button className="button button--outline" type="button" onClick={disableConnection} disabled={busy}>
            Disable
          </button>
        )}
        <a className="button button--outline" href="https://play.google.com/store/apps/details?id=org.owntracks.android" target="_blank" rel="noreferrer">
          Get OwnTracks <ExternalLink size={15} />
        </a>
      </div>

      {credentials && (
        <div className="android-credentials">
          <CopyValue label="HTTP endpoint" value={credentials.endpoint} />
          <CopyValue label="Username" value={credentials.username} />
          <CopyValue label="Password" value={credentials.password} />
        </div>
      )}

      <ol className="android-steps">
        <li>Install OwnTracks from Google Play and allow precise location <strong>all the time</strong>.</li>
        <li>Choose <strong>HTTP</strong> connection mode, then enter the endpoint, username, and password shown above.</li>
        <li>Use <strong>Manual</strong> monitoring mode so only geofence transitions are published.</li>
        <li>Allow remote waypoint updates, keep the ongoing notification enabled, and set Android battery use to <strong>Unrestricted</strong>.</li>
        <li>Publish once in OwnTracks. Buildr will return the enabled active-job geofences automatically.</li>
      </ol>

      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
