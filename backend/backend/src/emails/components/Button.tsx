/**
 * 邮件中的CTA按钮组件
 */

import React from 'react';
import { Button as EmailButton } from '@react-email/components';

interface ButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  className?: string;
}

export function Button({ 
  href, 
  children, 
  variant = 'primary',
  className = '' 
}: ButtonProps) {
  const baseClasses = 'px-6 py-3 rounded-lg font-semibold text-center inline-block no-underline transition-colors';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200'
  };

  return (
    <EmailButton
      href={href}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </EmailButton>
  );
}