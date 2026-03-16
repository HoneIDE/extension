/**
 * CanvasContext — for plugins that need custom rendering in their panel.
 *
 * This is the interface; the host provides the implementation.
 * Scoped to the plugin's panel area.
 */

export interface CanvasContext {
  /** Set the fill color (CSS color string). */
  setFillColor(color: string): void;

  /** Fill a rectangle. */
  fillRect(x: number, y: number, width: number, height: number): void;

  /** Set the stroke color. */
  setStrokeColor(color: string): void;

  /** Set the stroke width. */
  setStrokeWidth(width: number): void;

  /** Stroke a line from (x1,y1) to (x2,y2). */
  strokeLine(x1: number, y1: number, x2: number, y2: number): void;

  /** Stroke a rectangle outline. */
  strokeRect(x: number, y: number, width: number, height: number): void;

  /** Draw text at the given position. */
  drawText(text: string, x: number, y: number, fontSize?: number): void;

  /** Set the font. */
  setFont(family: string, size: number): void;

  /** Clear a rectangular area. */
  clearRect(x: number, y: number, width: number, height: number): void;

  /** Get the canvas width. */
  getWidth(): number;

  /** Get the canvas height. */
  getHeight(): number;
}
