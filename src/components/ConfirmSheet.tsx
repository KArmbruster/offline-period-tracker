'use client';

import { useState } from 'react';
import { Drawer as DrawerPrimitive } from 'vaul';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

export interface ConfirmSheetContent {
  title: string;
  message: string;
  confirmLabel: string;
  /** Leave out for a plain notice with a single button */
  cancelLabel?: string;
  /** Red confirm button for destructive actions */
  danger?: boolean;
  onConfirm?: () => void;
}

interface ConfirmSheetProps {
  /** What to ask or tell the user; null keeps the sheet closed */
  content: ConfirmSheetContent | null;
  onClose: () => void;
}

/**
 * Bottom sheet that replaces the browser's alert() and confirm() dialogs
 */
export default function ConfirmSheet({ content, onClose }: ConfirmSheetProps) {
  // Keep the last content on screen while the sheet animates out
  const [shown, setShown] = useState(content);
  if (content && content !== shown) {
    setShown(content);
  }
  const current = content ?? shown;

  const confirm = () => {
    const action = content?.onConfirm;
    onClose();
    action?.();
  };

  // Swiping a notice away counts as acknowledging it; a question is cancelled
  const dismiss = () => {
    if (content && !content.cancelLabel) {
      confirm();
    } else {
      onClose();
    }
  };

  return (
    <Drawer open={content !== null} onOpenChange={(open) => !open && dismiss()}>
      <DrawerContent>
        {current && (
          <>
            <DrawerHeader className="text-left">
              <DrawerTitle className="text-lg">{current.title}</DrawerTitle>
              <DrawerPrimitive.Description className="text-base text-gray-600">
                {current.message}
              </DrawerPrimitive.Description>
            </DrawerHeader>
            <div className="space-y-2 px-4 pb-8 safe-area-bottom">
              <button
                onClick={confirm}
                className={`h-12 w-full rounded-xl text-base font-semibold text-white ${
                  current.danger ? 'bg-red-600' : 'bg-brand-red'
                }`}
              >
                {current.confirmLabel}
              </button>
              {current.cancelLabel && (
                <button
                  onClick={onClose}
                  className="h-12 w-full rounded-xl border border-gray-200 text-base font-medium text-gray-700"
                >
                  {current.cancelLabel}
                </button>
              )}
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
