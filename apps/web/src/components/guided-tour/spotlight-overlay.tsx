import type { TargetRect } from './types';
import { SPOTLIGHT_PADDING } from './use-tour-target';

interface SpotlightOverlayProps {
  /** Unpadded rect of the step's target, or null while it is off screen. */
  rect: TargetRect | null;
  onClickOutside: () => void;
}

export function SpotlightOverlay({ rect, onClickOutside }: SpotlightOverlayProps): React.ReactElement {
  // WHY: with no target to cut a hole around, dim the page as one plain sheet.
  // Feeding a zero rect to the four strips below would black out the screen.
  if (!rect) {
    return <div className="fixed inset-0 z-[9998] bg-black/50" onClick={onClickOutside} />;
  }

  const top = rect.top - SPOTLIGHT_PADDING;
  const left = rect.left - SPOTLIGHT_PADDING;
  const width = rect.width + SPOTLIGHT_PADDING * 2;
  const height = rect.height + SPOTLIGHT_PADDING * 2;
  const right = Math.max(0, window.innerWidth - left - width);

  return (
    <>
      {/* Top strip */}
      <div
        className="fixed inset-0 z-[9998] bg-black/50"
        style={{ bottom: `calc(100vh - ${top}px)` }}
        onClick={onClickOutside}
      />
      {/* Bottom strip */}
      <div
        className="fixed inset-0 z-[9998] bg-black/50"
        style={{ top: `${top + height}px` }}
        onClick={onClickOutside}
      />
      {/* Left strip */}
      <div
        className="fixed z-[9998] bg-black/50"
        style={{ top: `${top}px`, left: 0, width: `${Math.max(0, left)}px`, height: `${height}px` }}
        onClick={onClickOutside}
      />
      {/* Right strip */}
      <div
        className="fixed z-[9998] bg-black/50"
        style={{ top: `${top}px`, right: 0, width: `${right}px`, height: `${height}px` }}
        onClick={onClickOutside}
      />
      {/* Highlight border ring */}
      <div
        className="fixed z-[9998] rounded-lg pointer-events-none"
        style={{
          top: `${top}px`,
          left: `${left}px`,
          width: `${width}px`,
          height: `${height}px`,
          boxShadow: '0 0 0 2px hsl(var(--primary))',
        }}
      />
    </>
  );
}
