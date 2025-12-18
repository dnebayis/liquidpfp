"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Dropzone from "react-dropzone";
import pica from "pica";
import {
  Canvas,
  FabricImage,
  FabricObject,
} from "fabric";
import { Download, Layers, RotateCcw, Trash2, Upload, Twitter } from "lucide-react";

import { ACCESSORIES, type AccessoryDef } from "@/lib/pfp/accessories";

const LOGICAL_SIZE = 1024;
const CSS_SIZE = 560;

type ExportSize = 512 | 1024 | 2048;
type ExportBg = "transparent" | "offblack" | "offwhite";
type ExportShape = "square" | "circle";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function buttonClass(variant: "primary" | "secondary" | "ghost" = "secondary") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ededff]/30 disabled:opacity-50 disabled:pointer-events-none";
  if (variant === "primary") {
    return `${base} bg-[#ededff] text-[#131318] hover:bg-white`;
  }
  if (variant === "ghost") {
    return `${base} bg-transparent text-[#ededff] hover:bg-white/10`;
  }
  return `${base} bg-white/10 text-[#ededff] hover:bg-white/15`;
}

function chipClass(active: boolean) {
  return [
    "rounded-full px-3 py-1 text-xs font-medium transition",
    active ? "bg-[#ededff] text-[#131318]" : "bg-white/10 text-[#ededff] hover:bg-white/15",
  ].join(" ");
}

export function PfpMaker() {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const photoRef = useRef<FabricImage | null>(null);
  const downloadLinkRef = useRef<HTMLAnchorElement | null>(null);

  const [activeObject, setActiveObject] = useState<FabricObject | null>(null);
  const [, bumpSelectionTick] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string | null>(null);
  const [exportSize, setExportSize] = useState<ExportSize>(1024);
  const [exportBg, setExportBg] = useState<ExportBg>("transparent");
  const [exportShape, setExportShape] = useState<ExportShape>("square");
  const [showCircleGuide, setShowCircleGuide] = useState(true);
  const [activeCategory, setActiveCategory] = useState<
    "All" | AccessoryDef["category"]
  >("All");

  const categories = useMemo(() => {
    const uniq = Array.from(new Set(ACCESSORIES.map((a) => a.category)));
    return ["All", ...uniq] as const;
  }, []);

  const accessoriesFiltered = useMemo(() => {
    if (activeCategory === "All") return ACCESSORIES;
    return ACCESSORIES.filter((a) => a.category === activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const ensurePhotoOnBottom = useCallback(() => {
    const canvas = fabricRef.current;
    const photo = photoRef.current;
    if (!canvas || !photo) return;
    if (!canvas.getObjects().includes(photo)) return;
    canvas.sendObjectToBack(photo);
    canvas.requestRenderAll();
  }, []);

  const syncActiveObject = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setActiveObject((canvas.getActiveObject() as FabricObject | undefined) ?? null);
    bumpSelectionTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    host.innerHTML = "";
    const el = document.createElement("canvas");
    host.appendChild(el);

    const canvas = new Canvas(el, {
      width: LOGICAL_SIZE,
      height: LOGICAL_SIZE,
      preserveObjectStacking: true,
      selection: true,
    });

    canvas.setDimensions({ width: CSS_SIZE, height: CSS_SIZE }, { cssOnly: true });
    canvas.calcOffset();

    canvas.backgroundColor = "rgba(255,255,255,0)";
    fabricRef.current = canvas;

    const handleSelection = () => syncActiveObject();
    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", handleSelection);
    canvas.on("object:modified", handleSelection);
    canvas.on("object:scaling", handleSelection);
    canvas.on("object:rotating", handleSelection);
    canvas.on("object:moving", handleSelection);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const activeObjects = canvas.getActiveObjects() as FabricObject[];
      if (!activeObjects.length) return;
      for (const obj of activeObjects) {
        if (photoRef.current && obj === photoRef.current) {
          photoRef.current = null;
        }
        canvas.remove(obj);
      }
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      syncActiveObject();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      canvas.dispose();
      fabricRef.current = null;
      photoRef.current = null;
      setActiveObject(null);
      host.innerHTML = "";
    };
  }, [syncActiveObject]);

  const fitObjectToCanvas = useCallback((obj: FabricObject, mode: "cover" | "contain") => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const cw = canvas.getWidth();
    const ch = canvas.getHeight();
    const ow = obj.getScaledWidth();
    const oh = obj.getScaledHeight();
    if (!ow || !oh) return;

    const coverScale = Math.max(cw / ow, ch / oh);
    const containScale = Math.min(cw / ow, ch / oh);
    const next = mode === "cover" ? coverScale : containScale;

    obj.scale((obj.scaleX ?? 1) * next);
    obj.set({
      left: cw / 2,
      top: ch / 2,
      originX: "center",
      originY: "center",
    });
    obj.setCoords();
    canvas.requestRenderAll();
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      setErrorMsg(null);
      setExportError(null);

      const url = URL.createObjectURL(file);
      try {
        const img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });
        img.set({
          originX: "center",
          originY: "center",
          left: canvas.getWidth() / 2,
          top: canvas.getHeight() / 2,
          selectable: true,
          data: { kind: "photo" },
          lockUniScaling: true,
          lockScalingFlip: true,
        });

        if (photoRef.current) {
          canvas.remove(photoRef.current);
        }
        photoRef.current = img;
        canvas.add(img);
        fitObjectToCanvas(img, "cover");
        ensurePhotoOnBottom();
        canvas.setActiveObject(img);
        canvas.requestRenderAll();
        syncActiveObject();
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    [ensurePhotoOnBottom, fitObjectToCanvas, syncActiveObject]
  );

  const addAccessory = useCallback(
    async (acc: AccessoryDef) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      setErrorMsg(null);

      try {
        const img = await FabricImage.fromURL(acc.src, { crossOrigin: "anonymous" });
        img.set({
          originX: "center",
          originY: "center",
          left: canvas.getWidth() / 2,
          top: canvas.getHeight() * acc.suggestedY,
          selectable: true,
          evented: true,
          data: { kind: "accessory", id: acc.id },
          lockUniScaling: true,
          lockScalingFlip: true,
          cornerStyle: "circle",
          cornerColor: "#ededff",
          cornerStrokeColor: "rgba(0,0,0,0)",
          borderColor: "rgba(237,237,255,0.65)",
          transparentCorners: false,
          padding: 5,
        });

        const targetW = canvas.getWidth() * acc.suggestedWidthRatio;
        const baseW = Math.max(1, img.width ?? img.getScaledWidth() ?? 1);
        img.scale(targetW / baseW);
        img.setCoords();

        canvas.add(img);
        canvas.bringObjectToFront(img);
        ensurePhotoOnBottom();
        canvas.setActiveObject(img);
        canvas.requestRenderAll();
        syncActiveObject();
      } catch {
        setErrorMsg(
          `Accessory image not found: ${acc.src}. Put the PNG files in public/pfp/accessories/.`
        );
      }
    },
    [ensurePhotoOnBottom, syncActiveObject]
  );

  const deleteSelected = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects() as FabricObject[];
    if (!activeObjects.length) return;
    for (const obj of activeObjects) {
      if (photoRef.current && obj === photoRef.current) {
        photoRef.current = null;
      }
      canvas.remove(obj);
    }
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    syncActiveObject();
  }, [syncActiveObject]);

  const bringForward = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject() as FabricObject | undefined;
    if (!active) return;
    canvas.bringObjectForward(active);
    ensurePhotoOnBottom();
    canvas.requestRenderAll();
  }, [ensurePhotoOnBottom]);

  const sendBackward = useCallback(() => {
    const canvas = fabricRef.current;
    const photo = photoRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject() as FabricObject | undefined;
    if (!active) return;
    canvas.sendObjectBackwards(active);
    if (photo) canvas.sendObjectToBack(photo);
    canvas.requestRenderAll();
  }, []);

  const resetSelectedTransform = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject() as FabricObject | undefined;
    if (!active) return;

    type ObjData = { kind?: "photo" | "accessory"; id?: string };
    const data = (active as unknown as { data?: ObjData }).data;

    if (photoRef.current && active === photoRef.current) {
      active.set({ angle: 0 });
      fitObjectToCanvas(active, "cover");
      ensurePhotoOnBottom();
      syncActiveObject();
      return;
    }

    if (data?.kind === "accessory" && data.id) {
      const def = ACCESSORIES.find((a) => a.id === data.id);
      if (def) {
        active.set({
          angle: 0,
          left: canvas.getWidth() / 2,
          top: canvas.getHeight() * def.suggestedY,
          originX: "center",
          originY: "center",
        });
        const targetW = canvas.getWidth() * def.suggestedWidthRatio;
        const baseW = Math.max(
          1,
          (active as unknown as { width?: number }).width ?? active.getScaledWidth() ?? 1
        );
        const s = targetW / baseW;
        active.set({ scaleX: s, scaleY: s });
      } else {
        active.set({ angle: 0 });
      }
    } else {
      active.set({ angle: 0 });
    }
    active.setCoords();
    canvas.requestRenderAll();
    syncActiveObject();
  }, [ensurePhotoOnBottom, fitObjectToCanvas, syncActiveObject]);

  const setSelectedRotation = useCallback(
    (deg: number) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const active = canvas.getActiveObject() as FabricObject | undefined;
      if (!active) return;
      active.rotate(deg);
      active.setCoords();
      canvas.requestRenderAll();
      syncActiveObject();
    },
    [syncActiveObject]
  );

  const setSelectedScalePct = useCallback(
    (pct: number) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const active = canvas.getActiveObject() as FabricObject | undefined;
      if (!active) return;
      const s = clamp(pct / 100, 0.02, 20);
      active.set({ scaleX: s, scaleY: s });
      active.setCoords();
      canvas.requestRenderAll();
      syncActiveObject();
    },
    [syncActiveObject]
  );

  const exportPng = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setExportError(null);
    setIsExporting(true);

    const prevBg = canvas.backgroundColor;
    const bg =
      exportBg === "transparent"
        ? "rgba(0,0,0,0)"
        : exportBg === "offblack"
          ? "#131318"
          : "#ededff";

    canvas.backgroundColor = bg;
    
    const activeObj = canvas.getActiveObject();
    if (activeObj) {
      canvas.discardActiveObject();
    }
    canvas.requestRenderAll();

    try {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const src = canvas.getElement();
      const resized = document.createElement("canvas");
      resized.width = exportSize;
      resized.height = exportSize;

      const p = pica();
      await p.resize(src, resized, {
        unsharpAmount: 80,
        unsharpRadius: 0.6,
        unsharpThreshold: 2,
      });

      const finalCanvas =
        exportShape === "circle" ? document.createElement("canvas") : resized;
      if (exportShape === "circle") {
        finalCanvas.width = exportSize;
        finalCanvas.height = exportSize;
        const ctx = finalCanvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, exportSize, exportSize);
        ctx.save();
        ctx.beginPath();
        ctx.arc(exportSize / 2, exportSize / 2, exportSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(resized, 0, 0);
        ctx.restore();
      }

      const blob = await p.toBlob(finalCanvas, "image/png", 1);

      const nextUrl = URL.createObjectURL(blob);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      const nextName = `liquid-pfp-${exportShape}-${exportSize}.png`;
      setDownloadUrl(nextUrl);
      setDownloadName(nextName);

      const a = document.createElement("a");
      a.href = nextUrl;
      a.download = nextName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      const refA = downloadLinkRef.current;
      if (refA) {
        refA.href = nextUrl;
        refA.download = nextName;
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Export failed. Please try again.";
      setExportError(msg);
    } finally {
      canvas.backgroundColor = prevBg;
      if (activeObj) {
        canvas.setActiveObject(activeObj);
      }
      canvas.requestRenderAll();
      setIsExporting(false);
    }
  }, [downloadUrl, exportBg, exportShape, exportSize]);

  const selectedRotation = Math.round(activeObject?.angle ?? 0);
  const selectedScalePct = Math.round(
    Math.sqrt((activeObject?.scaleX ?? 1) * (activeObject?.scaleY ?? 1)) * 100
  );
  const selectedIsPhoto = Boolean(photoRef.current && activeObject === photoRef.current);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0b10]/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/Icon-Offwhite.svg"
              alt="Liquid"
              width={28}
              height={28}
              priority
            />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">Liquid PFP Maker</span>
              <span className="text-xs text-[#ededff]/70">
                Upload → add accessories → rotate/scale → download
              </span>
            </div>
          </div>

          <nav className="hidden items-center gap-3 sm:flex">
            <a
              className="text-sm text-[#ededff]/80 hover:text-[#ededff]"
              href="https://tryliquid.xyz/"
              target="_blank"
              rel="noreferrer"
            >
              tryliquid.xyz
            </a>
            <span className="text-white/20">/</span>
            <a
              className="text-sm text-[#ededff]/80 hover:text-[#ededff]"
              href="https://docs.tryliquid.xyz/"
              target="_blank"
              rel="noreferrer"
            >
              docs
            </a>
            <span className="text-white/20">/</span>
            <a
              className="flex items-center gap-1.5 text-sm text-[#ededff]/80 transition-colors hover:text-[#ededff]"
              href="https://x.com/0xshawtyy"
              target="_blank"
              rel="noreferrer"
              title="@0xshawtyy"
            >
              <Twitter size={14} className="shrink-0" />
              <span className="hidden md:inline">@0xshawtyy</span>
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-5 py-8 lg:grid-cols-[1fr_360px]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <h1 className="text-lg font-semibold tracking-tight">Canvas</h1>
              <p className="text-sm text-[#ededff]/70">
                Drag to move. Use handles to rotate/scale. Select an item to fine-tune.
              </p>
            </div>
            <button
              className={buttonClass("ghost")}
              onClick={() => {
                const canvas = fabricRef.current;
                if (!canvas) return;
                canvas.clear();
                canvas.backgroundColor = "rgba(0,0,0,0)";
                photoRef.current = null;
                canvas.requestRenderAll();
                syncActiveObject();
                setErrorMsg(null);
                setExportError(null);
              }}
            >
              <RotateCcw size={16} />
              Clear
            </button>
          </div>

          {errorMsg ? (
            <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {errorMsg}
            </div>
          ) : null}
          {exportError ? (
            <div className="mt-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              Export error: {exportError}
            </div>
          ) : null}

          <div className="mt-5 flex items-center justify-center">
            <div className="relative rounded-2xl border border-white/10 bg-[#131318] p-4">
              <div
                className="absolute inset-4 rounded-xl"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg, rgba(237,237,255,0.08) 25%, transparent 25%), linear-gradient(-45deg, rgba(237,237,255,0.08) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(237,237,255,0.08) 75%), linear-gradient(-45deg, transparent 75%, rgba(237,237,255,0.08) 75%)",
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                  opacity: 0.6,
                  pointerEvents: "none",
                }}
              />
              {showCircleGuide ? (
                <div
                  className="absolute inset-4 rounded-xl"
                  style={{
                    pointerEvents: "none",
                  }}
                >
                  <div
                    className="absolute inset-3 rounded-full border border-[#ededff]/35"
                    style={{
                      boxShadow:
                        "0 0 0 1px rgba(0,0,0,0.25) inset, 0 0 0 9999px rgba(0,0,0,0.12)",
                    }}
                  />
                </div>
              ) : null}
              <div className="relative rounded-xl shadow-2xl">
                <div ref={canvasHostRef} className="rounded-xl" />
              </div>
            </div>
          </div>
        </section>

        <aside className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Upload</h2>
              <Dropzone
                multiple={false}
                accept={{ "image/*": [] }}
                onDrop={(accepted) => {
                  const file = accepted[0];
                  if (file) void handleUpload(file);
                }}
              >
                {({ getRootProps, getInputProps, isDragActive }) => (
                  <div
                    {...getRootProps()}
                    className={[
                      "mt-2 cursor-pointer rounded-2xl border border-white/15 bg-white/5 px-4 py-4 text-sm text-[#ededff]/80 transition",
                      isDragActive ? "bg-white/10" : "hover:bg-white/10",
                    ].join(" ")}
                  >
                    <input {...getInputProps()} />
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-white/10 p-2">
                        <Upload size={16} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-[#ededff]">
                          {isDragActive ? "Drop your photo" : "Click or drag a photo"}
                        </span>
                        <span className="text-xs text-[#ededff]/65">
                          Best results: square-ish, high-res, good lighting.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </Dropzone>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold tracking-tight">Accessories</h2>
                <div className="flex items-center gap-2">
                  {categories.map((c) => (
                    <button
                      key={c}
                      className={chipClass(activeCategory === c)}
                      onClick={() => setActiveCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {accessoriesFiltered.map((acc) => (
                  <button
                    key={acc.id}
                    className={[
                      "group rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10",
                    ].join(" ")}
                    onClick={() => void addAccessory(acc)}
                    title={acc.name}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                        <img
                          src={acc.src}
                          alt={acc.name}
                          className="h-full w-full object-contain p-1"
                          onError={(e) => {
                            e.currentTarget.style.opacity = "0";
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-[#ededff]">
                          {acc.name}
                        </div>
                        <div className="mt-1 text-[11px] text-[#ededff]/65">{acc.category}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={16} />
                  <h2 className="text-sm font-semibold tracking-tight">Selected</h2>
                </div>
                <button
                  className={buttonClass("ghost")}
                  onClick={deleteSelected}
                  disabled={!activeObject}
                >
                  <Trash2 size={16} />
                  {selectedIsPhoto ? "Remove photo" : "Delete"}
                </button>
              </div>

              {!activeObject ? (
                <p className="mt-3 text-sm text-[#ededff]/70">
                  Select the photo or an accessory to enable rotation/scale controls.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-xs font-medium text-[#ededff]/80">Type</span>
                    <span className="text-xs text-[#ededff]/70">
                      {selectedIsPhoto ? "Photo" : "Overlay"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#ededff]/80">Rotation</span>
                      <span className="text-xs tabular-nums text-[#ededff]/70">
                        {selectedRotation}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-45}
                      max={45}
                      step={1}
                      value={clamp(selectedRotation, -45, 45)}
                      onChange={(e) => setSelectedRotation(Number(e.target.value))}
                      className="w-full accent-[#ededff]"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#ededff]/80">Scale</span>
                      <span className="text-xs tabular-nums text-[#ededff]/70">
                        {selectedScalePct}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={200}
                      step={1}
                      value={clamp(selectedScalePct, 20, 200)}
                      onChange={(e) => setSelectedScalePct(Number(e.target.value))}
                      className="w-full accent-[#ededff]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button className={buttonClass("secondary")} onClick={resetSelectedTransform}>
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-4">
                <h2 className="text-sm font-semibold tracking-tight">Export</h2>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  className={`${buttonClass("secondary")} whitespace-nowrap`}
                  onClick={() => {
                    const text = encodeURIComponent(
                      "Just created my PFP with Liquid PFP Maker! 🎨✨ @liquidtrading update on github"
                    );
                    const twitterUrl = `https://twitter.com/intent/tweet?text=${text}`;
                    window.open(twitterUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  <Twitter size={16} />
                  Share on X
                </button>
                <button
                  className={`${buttonClass("primary")} whitespace-nowrap`}
                  onClick={() => void exportPng()}
                  disabled={isExporting}
                >
                  <Download size={16} />
                  {isExporting ? "Exporting..." : "Download PNG"}
                </button>
              </div>

              <a ref={downloadLinkRef} className="hidden" />

              {downloadUrl && downloadName ? (
                <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-[#ededff]/80">
                  Download ready:{" "}
                  <a
                    href={downloadUrl}
                    download={downloadName}
                    className="font-semibold text-[#ededff] underline underline-offset-2 hover:no-underline"
                  >
                    click here
                  </a>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="text-xs font-medium text-[#ededff]/80">Size</div>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#ededff] outline-none focus:ring-2 focus:ring-white/20"
                    value={exportSize}
                    onChange={(e) => setExportSize(Number(e.target.value) as ExportSize)}
                  >
                    <option value={512}>512×512</option>
                    <option value={1024}>1024×1024</option>
                    <option value={2048}>2048×2048</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <div className="text-xs font-medium text-[#ededff]/80">Background</div>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#ededff] outline-none focus:ring-2 focus:ring-white/20"
                    value={exportBg}
                    onChange={(e) => setExportBg(e.target.value as ExportBg)}
                  >
                    <option value="transparent">Transparent</option>
                    <option value="offblack">Off-black</option>
                    <option value="offwhite">Off-white</option>
                  </select>
                </label>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="text-xs font-medium text-[#ededff]/80">Shape</div>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#ededff] outline-none focus:ring-2 focus:ring-white/20"
                    value={exportShape}
                    onChange={(e) => setExportShape(e.target.value as ExportShape)}
                  >
                    <option value="square">Square</option>
                    <option value="circle">Circle</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <div className="text-xs font-medium text-[#ededff]/80">Canvas guide</div>
                  <button
                    type="button"
                    className={buttonClass("secondary")}
                    onClick={() => setShowCircleGuide((v) => !v)}
                  >
                    {showCircleGuide ? "Hide circle preview" : "Show circle preview"}
                  </button>
                </label>
              </div>

              <p className="mt-3 text-xs text-[#ededff]/65">
                Uses Fabric.js for transforms + Pica (Lanczos) for high-quality downscaling.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <Image
                  src="/brand/Full-Logo-Offwhite.svg"
                  alt="Liquid"
                  width={160}
                  height={32}
                />
                <span className="text-xs text-[#ededff]/60">
                  Built for fast, polished PFP edits.
                </span>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}


