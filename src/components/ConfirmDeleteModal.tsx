"use client";

import { AlertTriangle, X } from "lucide-react";
import { Spinner } from "@/components/Loader";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  productName?: string;
  confirmLabel?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteModal({
  isOpen,
  title = "Delete Product",
  message,
  productName,
  confirmLabel = "Delete",
  loading = false,
  onClose,
  onConfirm,
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4"
      onClick={loading ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="btn-ghost -mr-1.5 -mt-1 p-1 text-ink-faint hover:text-ink disabled:opacity-40"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              {message ?? (
                <>
                  Are you sure you want to delete{" "}
                  {productName ? (
                    <span className="font-semibold text-ink">&ldquo;{productName}&rdquo;</span>
                  ) : (
                    "this product"
                  )}
                  ? This will permanently remove the product from your store and buyers will no longer be able to purchase it.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            className="btn-outline flex-1 sm:flex-none sm:min-w-[90px]"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn flex-1 sm:flex-none sm:min-w-[110px] bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner className="h-4 w-4 border-white/30 border-t-white" />
                <span>Deleting…</span>
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
