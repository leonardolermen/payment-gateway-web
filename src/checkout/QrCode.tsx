import QRCode from "qrcode";
import { useEffect, useRef } from "react";

// Drawn locally on a canvas: sending the copia-e-cola to a QR image service would hand a third
// party a payable charge.
export function QrCode({ text }: { text: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      void QRCode.toCanvas(canvasRef.current, text, { width: 240 });
    }
  }, [text]);

  // White frame in both themes: phone readers need light quiet zone around dark modules, and a
  // dark-theme surface behind the canvas made them fail to lock on.
  return (
    <div className="mx-auto w-fit rounded-xl bg-white p-2">
      <canvas ref={canvasRef} aria-label="QR Code Pix" className="block max-w-full" />
    </div>
  );
}
