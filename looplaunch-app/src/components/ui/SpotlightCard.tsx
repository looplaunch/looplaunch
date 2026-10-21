'use client';

import React, { useRef, useState, useCallback } from 'react';
import './SpotlightCard.css';

export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  radius?: number;
  surfaceGlow?: string;
  borderGlow?: string;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  contentClassName = '',
  radius = 320,
  surfaceGlow = 'rgba(255, 255, 255, 0.02)',
  borderGlow = 'rgba(139, 92, 246, 0.25)',
  style,
  onMouseMove,
  onMouseEnter,
  onMouseLeave,
  ...rest
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      cardRef.current.style.setProperty('--mouse-x', `${x}px`);
      cardRef.current.style.setProperty('--mouse-y', `${y}px`);
      cardRef.current.style.setProperty('--spotlight-opacity', '1');

      if (onMouseMove) onMouseMove(e);
    },
    [onMouseMove]
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setIsHovered(true);
      if (cardRef.current) {
        cardRef.current.style.setProperty('--spotlight-opacity', '1');
      }
      if (onMouseEnter) onMouseEnter(e);
    },
    [onMouseEnter]
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setIsHovered(false);
      if (cardRef.current) {
        cardRef.current.style.setProperty('--spotlight-opacity', '0');
      }
      if (onMouseLeave) onMouseLeave(e);
    },
    [onMouseLeave]
  );

  const dynamicStyles = {
    '--spotlight-radius': `${radius}px`,
    '--surface-glow': surfaceGlow,
    '--border-glow': borderGlow,
    ...style,
  } as React.CSSProperties;

  return (
    <div
      ref={cardRef}
      className={`spotlight-card ${className}`}
      style={dynamicStyles}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...rest}
    >
      <div className={`spotlight-card-content ${contentClassName}`}>{children}</div>
    </div>
  );
};

export default SpotlightCard;
