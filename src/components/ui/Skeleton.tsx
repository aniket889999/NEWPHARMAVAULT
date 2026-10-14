import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'text' }) => {
  const baseStyle = 'animate-pulse bg-gray-200';
  
  const variants = {
    text: 'h-4 w-full rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-xl'
  };

  return (
    <div className={`${baseStyle} ${variants[variant]} ${className}`} />
  );
};
