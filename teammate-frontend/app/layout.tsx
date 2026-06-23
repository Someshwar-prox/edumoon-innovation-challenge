import { Analytics } from '@vercel/analytics/next';
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'AIBridge — AI Readiness & Chatbot Platform',
  description:
    'AIBridge helps businesses understand their AI maturity, deploy smart chatbots trained on their own content, and generate readiness reports in minutes.',
  icons: {
    icon: [
      { url: '/logo-round.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo-round.png', sizes: '192x192', type: 'image/png' },
      { url: '/logo-round.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/logo-round.png',
  },
};

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
  ],
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  );
}