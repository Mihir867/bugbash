// components/ui/container.tsx
import React from 'react';

type ContainerProps = {
  children: React.ReactNode;
  className?: string;
};

const Container = ({ children, className = '' }: ContainerProps) => {
  return (
    <div className={`w-full bg-black`}>
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 ${className}`}>
        {children}
      </div>
    </div>
  );
};

export default Container;
