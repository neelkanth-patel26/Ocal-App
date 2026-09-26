/**
 * HTML5 Real-time QR Code Camera Scanner for Mobile
 * Utilizes native BarcodeDetector API when available with high-speed
 * jsQR software fallback for 100% device compatibility.
 * Features torch support, front/back camera flipping, and image file scanning.
 */

import jsQR from 'jsqr';

export class QrScanner {
  constructor() {
    this.stream = null;
    this.videoEl = null;
    this.animFrameId = null;
    this.isScanning = false;
    this.detector = null;
    this.canvas = null;
    this.ctx = null;
    this.lastScanTime = 0;
    this.facingMode = 'environment';
    this.torchActive = false;
  }

  static isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async start(videoElement, onResult, onError) {
    this.stop();
    this.videoEl = videoElement;

    // Check & request native Android permission if available
    try {
      if (window.OcalNative && typeof window.OcalNative.requestCameraPermission === 'function') {
        window.OcalNative.requestCameraPermission();
      }
    } catch (e) {}

    if (!QrScanner.isSupported()) {
      if (onError) onError(new Error('Camera access not supported on this device.'));
      return;
    }

    try {
      this.stream = await this._getMediaStream();

      if (!this.videoEl) return;
      this.videoEl.srcObject = this.stream;
      this.videoEl.setAttribute('playsinline', 'true');
      this.videoEl.setAttribute('webkit-playsinline', 'true');
      this.videoEl.setAttribute('autoplay', 'true');
      this.videoEl.muted = true;
      this.videoEl.playsInline = true;

      // Ensure video is ready before playing
      await new Promise((resolve) => {
        if (this.videoEl.readyState >= 2) {
          resolve();
        } else {
          this.videoEl.onloadedmetadata = () => resolve();
          setTimeout(resolve, 800); // Fallback timeout
        }
      });

      await this.videoEl.play().catch(e => console.warn('[QrScanner] Play warning:', e));

      this.isScanning = true;

      // Offscreen canvas for software decoding
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

      // Check native BarcodeDetector
      if ('BarcodeDetector' in window) {
        try {
          this.detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        } catch (e) {
          this.detector = null;
        }
      }

      this._scanLoop(onResult, onError);
    } catch (err) {
      this.stop();
      if (onError) onError(err);
    }
  }

  async _getMediaStream() {
    const attempts = [
      // 1. High-resolution preferred facingMode
      {
        video: {
          facingMode: { ideal: this.facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      },
      // 2. Standard resolution preferred facingMode
      {
        video: {
          facingMode: this.facingMode
        },
        audio: false
      },
      // 3. Fallback generic camera
      {
        video: true,
        audio: false
      }
    ];

    let lastError = null;
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) return stream;
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('Failed to acquire camera stream');
  }

  async switchCamera(onResult, onError) {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    if (this.videoEl && this.isScanning) {
      await this.start(this.videoEl, onResult, onError);
    }
    return this.facingMode;
  }

  async toggleTorch() {
    if (!this.stream) return false;
    const track = this.stream.getVideoTracks()[0];
    if (!track) return false;

    try {
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (!capabilities.torch) {
        return false;
      }

      this.torchActive = !this.torchActive;
      await track.applyConstraints({
        advanced: [{ torch: this.torchActive }]
      });
      return this.torchActive;
    } catch (e) {
      console.warn('[QrScanner] Torch error:', e);
      return false;
    }
  }

  // Scan a static image File or Blob (e.g. from gallery/screenshot)
  async scanImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
          try {
            // 1. Try BarcodeDetector if available
            if ('BarcodeDetector' in window) {
              try {
                const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
                const barcodes = await detector.detect(img);
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  return resolve(barcodes[0].rawValue);
                }
              } catch (detErr) {}
            }

            // 2. Software jsQR decode
            const cvs = document.createElement('canvas');
            const ctx = cvs.getContext('2d', { willReadFrequently: true });
            cvs.width = img.naturalWidth || img.width;
            cvs.height = img.naturalHeight || img.height;
            ctx.drawImage(img, 0, 0);

            const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
            const code = jsQR(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'attemptBoth'
            });

            if (code && code.data) {
              resolve(code.data);
            } else {
              reject(new Error('No valid QR code found in the selected image.'));
            }
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image file.'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
  }

  _scanLoop(onResult, onError) {
    if (!this.isScanning || !this.videoEl) return;

    if (this.videoEl.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      const now = performance.now();
      // Scan every ~50ms (20 fps) for responsive detection
      if (now - this.lastScanTime > 50) {
        this.lastScanTime = now;

        // 1. Try native BarcodeDetector if available
        if (this.detector) {
          this.detector.detect(this.videoEl)
            .then((barcodes) => {
              if (!this.isScanning) return;
              if (barcodes && barcodes.length > 0) {
                const rawValue = barcodes[0].rawValue;
                if (rawValue) {
                  this.stop();
                  if (onResult) onResult(rawValue);
                  return;
                }
              }
              // If native detector found nothing in this frame, try jsQR fallback
              this._tryJsQr(onResult);
            })
            .catch(() => {
              this._tryJsQr(onResult);
            });
        } else {
          // 2. Direct pure JS scan with jsQR
          this._tryJsQr(onResult);
        }
      }
    }

    if (this.isScanning) {
      this.animFrameId = requestAnimationFrame(() => this._scanLoop(onResult, onError));
    }
  }

  _tryJsQr(onResult) {
    if (!this.isScanning || !this.videoEl || !this.ctx) return;
    try {
      const vw = this.videoEl.videoWidth;
      const vh = this.videoEl.videoHeight;
      if (!vw || !vh) return;

      // Downscale if camera resolution is very high for fast CPU decoding
      const maxDim = 640;
      let scale = 1;
      if (vw > maxDim || vh > maxDim) {
        scale = Math.min(maxDim / vw, maxDim / vh);
      }
      const w = Math.round(vw * scale);
      const h = Math.round(vh * scale);

      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }

      this.ctx.drawImage(this.videoEl, 0, 0, w, h);
      const imageData = this.ctx.getImageData(0, 0, w, h);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth'
      });

      if (code && code.data) {
        this.stop();
        if (onResult) onResult(code.data);
      }
    } catch (e) {
      // Ignore frame read errors
    }
  }

  stop() {
    this.isScanning = false;
    this.torchActive = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
    this.canvas = null;
    this.ctx = null;
  }
}
