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

  return <canvas ref={canvasRef} aria-label="QR Code Pix" className="mx-auto" />;
}
