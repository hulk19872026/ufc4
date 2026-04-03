'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const path = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-[#0e0e1a] border-b border-white/[0.07] backdrop-blur-md">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <span className="text-2xl">🥊</span>
          <span className="font-bold text-lg tracking-wide font-['Barlow_Condensed',sans-serif]">
            UFC<span className="text-red-500">ANALYZER</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {[
            { href: '/', label: 'Fight Card' },
            { href: '/fights', label: 'Events' },
            { href: '/predictions', label: 'Predictions' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                path === href
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
