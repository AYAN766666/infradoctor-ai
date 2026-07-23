import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/ui/toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'InfraDoctor AI - AI-Powered Infrastructure Monitoring',
    template: '%s | InfraDoctor AI',
  },
  description: 'AI-powered DevOps monitoring and incident management platform. Predict incidents, automate root cause analysis, and heal your cloud infrastructure.',
  keywords: ['infrastructure monitoring', 'AI DevOps', 'cloud monitoring', 'incident management', 'security scanning', 'GitHub secrets detection'],
  authors: [{ name: 'InfraDoctor AI' }],
  creator: 'InfraDoctor AI',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'InfraDoctor AI',
    title: 'InfraDoctor AI - AI-Powered Infrastructure Monitoring',
    description: 'Predict incidents before they happen, automate root cause analysis, and heal your cloud infrastructure with AI.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'InfraDoctor AI',
    description: 'AI-powered infrastructure monitoring and security scanning.',
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  manifest: '/manifest.json',
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
