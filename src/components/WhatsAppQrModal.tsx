"use client";

import { useEffect, useState } from "react";
import { X, Loader2, CheckCircle, Smartphone, AlertCircle } from "lucide-react";

interface WhatsAppQrModalProps {
  instanceName: string;
  onClose: () => void;
  onConnected: () => void;
}

export function WhatsAppQrModal({ instanceName, onClose, onConnected }: WhatsAppQrModalProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "waiting" | "connected" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  const fetchQr = async () => {
    try {
      const res = await fetch(`/api/auth/evolution/qr/${instanceName}`);
      const data = await res.json();
      if (data.qrCode) setQrCode(data.qrCode);
    } catch {
      setError("Failed to load QR code");
    }
  };

  const checkStatus = async () => {
    try {
      const res = await fetch(`/api/auth/evolution/status/${instanceName}`);
      const data = await res.json();
      if (data.state === "open") {
        setStatus("connected");
        onConnected();
      } else if (data.state === "connecting") {
        setStatus("waiting");
        setPollCount((c) => c + 1);
        if (pollCount < 30) setTimeout(checkStatus, 2000);
        else setError("Connection timeout. Please try again.");
      } else {
        setStatus("waiting");
        setPollCount((c) => c + 1);
        if (pollCount < 30) setTimeout(checkStatus, 2000);
        else setError("Connection timeout. Please try again.");
      }
    } catch {
      setPollCount((c) => c + 1);
      if (pollCount < 30) setTimeout(checkStatus, 2000);
      else setError("Failed to check status");
    }
  };

  useEffect(() => {
    fetchQr();
    const timer = setTimeout(checkStatus, 3000);
    return () => clearTimeout(timer);
  }, [instanceName]);

  if (status === "connected") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center animate-fade-in">
          <CheckCircle className="mx-auto h-16 w-16 text-emerald-500" />
          <h3 className="mt-4 text-xl font-bold text-ink">WhatsApp Connected!</h3>
          <p className="mt-2 text-ink-faint">You can now close this window and continue.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full animate-fade-in relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-lg hover:bg-gray-100 text-ink-faint"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-10 w-10 animate-spin text-brand-600" />
            <p className="mt-3 text-ink-faint">Loading QR code...</p>
          </div>
        )}

        {status === "waiting" && qrCode && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-center">
              <Smartphone className="h-8 w-8 text-brand-600" />
              <h3 className="text-lg font-bold text-ink">Scan QR Code</h3>
            </div>
            <p className="text-center text-sm text-ink-faint">
              Open WhatsApp → Settings → Linked Devices → Link a Device
            </p>
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <img
                src={`data:image/png;base64,${qrCode}`}
                alt="WhatsApp QR Code"
                className="mx-auto w-64 h-64"
              />
            </div>
            <p className="text-center text-xs text-ink-faint">
              Waiting for connection... ({pollCount}/30)
            </p>
            {error && (
              <div className="flex items-center gap-2 text-center text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="text-center py-8">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
            <h3 className="mt-3 text-lg font-bold text-ink">Connection Failed</h3>
            <p className="mt-1 text-ink-faint">{error || "Please try again"}</p>
            <button
              onClick={() => {
                setStatus("loading");
                setError(null);
                setPollCount(0);
                fetchQr();
                setTimeout(checkStatus, 3000);
              }}
              className="mt-4 btn-primary"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}