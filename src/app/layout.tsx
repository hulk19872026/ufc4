import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'UFC Fight Analyzer',
  description: 'AI-powered UFC fight analysis, win probabilities, round scoring & prediction tracking',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🥊</text></svg>" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#080810] text-white min-h-screen">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 pb-20 pt-4">
          {children}
        </main>
      </body>
    </html>
  );
}
