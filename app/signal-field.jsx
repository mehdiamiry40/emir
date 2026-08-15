"use client";

import { useEffect, useRef } from "react";

const RAY_COUNT = 128;
const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** @param {{ className?: string }} props */
export default function SignalField({ className = "" }) {
  const canvasRef = useRef(/** @type {HTMLCanvasElement | null} */ (null));

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const metrics = { width: 0, height: 0, dpr: 1 };
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let animationFrame = 0;

    const draw = (time = 0) => {
      const { width, height, dpr } = metrics;
      if (width <= 0 || height <= 0) return;

      pointer.x += (pointer.targetX - pointer.x) * 0.055;
      pointer.y += (pointer.targetY - pointer.y) * 0.055;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.485;
      const motion = motionQuery.matches ? 0 : time * 0.00038;

      context.lineCap = "round";

      for (let index = 0; index < RAY_COUNT; index += 1) {
        const angle = (index / RAY_COUNT) * TAU - Math.PI / 2;
        const directionX = Math.cos(angle);
        const directionY = Math.sin(angle);
        const tangentX = -directionY;
        const tangentY = directionX;
        const endX = centerX + directionX * radius;
        const endY = centerY + directionY * radius;
        const wave = Math.sin(motion * 2.1 + index * 0.37) * radius * 0.012;
        const pointerFlow =
          (pointer.x * tangentX + pointer.y * tangentY) * radius * 0.04;
        const controlRadius =
          radius * (0.5 + Math.sin(motion + index * 0.19) * 0.025);
        const controlX =
          centerX + directionX * controlRadius + tangentX * (wave + pointerFlow);
        const controlY =
          centerY + directionY * controlRadius + tangentY * (wave + pointerFlow);
        const alpha = 0.18 + ((index * 17) % 9) * 0.009;

        context.beginPath();
        context.moveTo(centerX, centerY);
        context.quadraticCurveTo(controlX, controlY, endX, endY);
        context.strokeStyle = `rgba(247, 249, 255, ${alpha})`;
        context.lineWidth = index % 4 === 0 ? 0.9 : 0.65;
        context.stroke();
      }

      context.fillStyle = "rgba(250, 250, 247, 0.96)";
      for (let index = 0; index < RAY_COUNT; index += 1) {
        const angle = (index / RAY_COUNT) * TAU - Math.PI / 2;
        const endX = centerX + Math.cos(angle) * radius;
        const endY = centerY + Math.sin(angle) * radius;

        context.beginPath();
        context.arc(endX, endY, index % 4 === 0 ? 1.7 : 1.35, 0, TAU);
        context.fill();
      }

      context.beginPath();
      context.arc(centerX, centerY, 2.3, 0, TAU);
      context.fill();
      canvas.dataset.ready = "true";
    };

    const animate = (/** @type {number} */ time) => {
      draw(time);
      animationFrame = window.requestAnimationFrame(animate);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (width === 0 || height === 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      metrics.width = width;
      metrics.height = height;
      metrics.dpr = dpr;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      draw(performance.now());
    };

    const handlePointerMove = (/** @type {PointerEvent} */ event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.targetX = clamp(
        (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2),
        -1,
        1,
      );
      pointer.targetY = clamp(
        (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2),
        -1,
        1,
      );
    };

    const resetPointer = () => {
      pointer.targetX = 0;
      pointer.targetY = 0;
    };

    const restartAnimation = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      if (document.hidden || motionQuery.matches) {
        pointer.x = 0;
        pointer.y = 0;
        draw(document.hidden ? 0 : performance.now());
        return;
      }
      animationFrame = window.requestAnimationFrame(animate);
    };

    const handleVisibility = () => {
      restartAnimation();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("blur", resetPointer);
    document.addEventListener("visibilitychange", handleVisibility);
    motionQuery.addEventListener("change", restartAnimation);
    resize();
    restartAnimation();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", resetPointer);
      document.removeEventListener("visibilitychange", handleVisibility);
      motionQuery.removeEventListener("change", restartAnimation);
    };
  }, []);

  return (
    <div
      className={`signalField ${className}`.trim()}
      data-ray-count={RAY_COUNT}
      aria-hidden="true"
    >
      <canvas className="signalCanvas" ref={canvasRef} />
    </div>
  );
}
