/**
 * 邮件通用布局组件
 */

import React from 'react';
import { 
  Html, 
  Head, 
  Preview, 
  Body, 
  Container, 
  Section,
  Tailwind 
} from '@react-email/components';
import { Header } from './Header';
import { Footer } from './Footer';

interface LayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function Layout({ preview, children }: LayoutProps) {
  return (
    <Html lang="zh-CN">
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-8 px-4 max-w-2xl">
            <Section className="bg-white rounded-lg shadow-sm border border-gray-200">
              <Header />
              <Section className="px-8 py-6">
                {children}
              </Section>
              <Footer />
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}