import React from "react";

// Brand logo component props
interface LogoProps {
  className?: string;
  style?: React.CSSProperties;
}

// X (Twitter) logo
export function XLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// YouTube logo
export function YouTubeLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <path
        fill="#FF0000"
        d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
      />
    </svg>
  );
}

// Google logo (G icon)
export function GoogleLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

// Gmail logo
export function GmailLogo({ className, style }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/favicons/gmail.png"
      alt="Gmail"
      className={className}
      style={style}
    />
  );
}

// Y Combinator logo
export function YCombinatorLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <rect fill="#FF6600" width="24" height="24" rx="2" />
      <path
        fill="white"
        d="M7.8 5.4h1.8l2.4 4.8 2.4-4.8h1.8l-3.5 6.6v4.6h-1.4v-4.6L7.8 5.4z"
      />
    </svg>
  );
}

// GitHub logo
export function GitHubLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

// Reddit logo
export function RedditLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <circle fill="#FF4500" cx="12" cy="12" r="12" />
      <path
        fill="white"
        d="M19.5 12c0-.94-.76-1.7-1.7-1.7-.46 0-.87.18-1.17.48-1.16-.84-2.75-1.38-4.52-1.44l.77-3.63 2.5.53c.03.66.58 1.19 1.25 1.19.69 0 1.25-.56 1.25-1.25s-.56-1.25-1.25-1.25c-.49 0-.91.28-1.12.69l-2.8-.6c-.13-.03-.27.06-.3.2l-.86 4.06c-1.8.05-3.43.59-4.6 1.44-.3-.29-.72-.48-1.18-.48-.94 0-1.7.76-1.7 1.7 0 .67.39 1.24.94 1.52-.03.17-.04.35-.04.53 0 2.69 3.13 4.87 7 4.87s7-2.18 7-4.87c0-.18-.01-.36-.05-.53.56-.27.95-.85.95-1.52zM8.5 13.25c0-.69.56-1.25 1.25-1.25s1.25.56 1.25 1.25-.56 1.25-1.25 1.25-1.25-.56-1.25-1.25zm6.97 3.23c-.86.86-2.5.93-3.47.93s-2.61-.07-3.47-.93c-.12-.12-.12-.31 0-.43.12-.12.31-.12.43 0 .54.54 1.69.73 3.04.73s2.5-.19 3.04-.73c.12-.12.31-.12.43 0 .12.12.12.31 0 .43zm-.22-1.98c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z"
      />
    </svg>
  );
}

// Medium logo
export function MediumLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
      <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" />
    </svg>
  );
}

// LinkedIn logo
export function LinkedInLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <rect fill="#0A66C2" width="24" height="24" rx="2" />
      <path
        fill="white"
        d="M7.5 8.5h-3v9h3v-9zm-1.5-1c1 0 1.5-.7 1.5-1.5S7 4.5 6 4.5 4.5 5.2 4.5 6 5 7.5 6 7.5zm12 10h-3v-4.5c0-1.5-.5-2.5-1.8-2.5-1 0-1.5.7-1.7 1.3-.1.2-.1.5-.1.8v4.9h-3s.04-8 0-9h3v1.3c.4-.6 1.1-1.5 2.7-1.5 2 0 3.5 1.3 3.5 4.2v5h.4z"
      />
    </svg>
  );
}

// Substack logo
export function SubstackLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <path fill="#FF6719" d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24l9.56-5.49 9.559 5.49V10.812H1.46zm0-8.243h21.08v2.836H1.46V2.57z" />
    </svg>
  );
}

// Notion logo
export function NotionLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.166V6.354c0-.606-.233-.933-.748-.886l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.094-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.454-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.513.28-.886.747-.933zM2.64 1.782l13.168-.933c1.636-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.933.653.933 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V3.598c0-.839.374-1.54 1.59-1.817z" />
    </svg>
  );
}

// Hacker News logo
export function HackerNewsLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <rect fill="#FF6600" width="24" height="24" />
      <path
        fill="white"
        d="M6.25 5h2.17l3.56 6.55L15.6 5h2.17l-4.76 8.5V19h-2v-5.5L6.25 5z"
      />
    </svg>
  );
}

// Spotify logo
export function SpotifyLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <path
        fill="#1DB954"
        d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
      />
    </svg>
  );
}

// Apple Podcasts logo
export function ApplePodcastsLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <defs>
        <linearGradient id="podcast-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F452FF" />
          <stop offset="100%" stopColor="#832BC1" />
        </linearGradient>
      </defs>
      <rect fill="url(#podcast-gradient)" width="24" height="24" rx="5.4" />
      <path
        fill="white"
        d="M12 5.5c-3.58 0-6.5 2.92-6.5 6.5 0 2.08.99 3.93 2.52 5.12.17.13.42.1.55-.08l.78-1.11c.12-.17.09-.4-.07-.54-.88-.73-1.44-1.83-1.44-3.06 0-2.21 1.79-4 4-4s4 1.79 4 4c0 1.23-.56 2.33-1.44 3.06-.16.14-.19.37-.07.54l.78 1.11c.13.18.38.21.55.08 1.53-1.19 2.52-3.04 2.52-5.12 0-3.58-2.92-6.5-6.5-6.5zm0 3c-1.93 0-3.5 1.57-3.5 3.5 0 .97.4 1.85 1.04 2.49.15.15.39.15.54 0l.78-.78c.13-.13.14-.34.02-.48-.32-.37-.51-.85-.51-1.38 0-1.1.9-2 2-2s2 .9 2 2c0 .53-.19 1.01-.51 1.38-.12.14-.11.35.02.48l.78.78c.15.15.39.15.54 0 .64-.64 1.04-1.52 1.04-2.49 0-1.93-1.57-3.5-3.5-3.5zm0 4.5c-.55 0-1 .45-1 1 0 .26.1.49.27.67l.03 3.66c0 .39.31.67.7.67s.7-.28.7-.67l.03-3.66c.17-.18.27-.41.27-.67 0-.55-.45-1-1-1z"
      />
    </svg>
  );
}

// Wikipedia logo
export function WikipediaLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
      <path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601 1.082 2.646 4.818 10.521 4.818 10.521l.136.046 2.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0 .105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136 1.422l1.582 3.252 1.758-3.504c.293-.64.233-.801.111-.947-.07-.084-.305-.22-.812-.24l-.201-.021c-.052 0-.098-.015-.145-.051-.045-.031-.067-.076-.067-.129v-.427l.061-.045c1.247-.008 4.043 0 4.043 0l.059.045v.436c0 .121-.059.178-.193.178-.646.03-.782.095-1.023.439-.12.186-.375.589-.646 1.039l-2.301 4.273-.065.135 2.792 5.712.17.048 4.396-10.438c.154-.422.129-.722-.064-.895-.197-.172-.346-.273-.857-.295l-.42-.016c-.061 0-.105-.014-.152-.045-.043-.029-.072-.075-.072-.119v-.436l.059-.045h4.961l.041.045v.437c0 .119-.074.18-.209.18-.648.03-1.127.18-1.443.421-.314.255-.557.616-.736 1.067 0 0-4.043 9.258-5.426 12.339-.525 1.007-1.053.917-1.503-.031-.571-1.171-1.773-3.786-2.646-5.71l.053-.036z" />
    </svg>
  );
}

// Arxiv logo
export function ArxivLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <rect fill="#B31B1B" width="24" height="24" rx="2" />
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="serif">
        arXiv
      </text>
    </svg>
  );
}

// Anthropic logo (using favicon image)
export function AnthropicLogo({ className, style }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/favicons/anthropic.png"
      alt="Anthropic"
      className={className}
      style={style}
    />
  );
}

// OpenAI logo
export function OpenAILogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  );
}

// The Information logo (using favicon image)
export function TheInformationLogo({ className, style }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/favicons/theinformation.png"
      alt="The Information"
      className={className}
      style={style}
    />
  );
}

// TechCrunch logo
export function TechCrunchLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <rect fill="#0A9E01" width="24" height="24" rx="2" />
      <path fill="white" d="M5 8h14v2H5V8zm4 4h10v2H9v-2zm-4 4h14v2H5v-2z" />
    </svg>
  );
}

// The Verge logo
export function TheVergeLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <path fill="#000000" d="M12 2L2 22h6l4-10 4 10h6L12 2z" />
    </svg>
  );
}

// Wired logo
export function WiredLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <rect fill="#000000" width="24" height="24" rx="2" />
      <text x="12" y="15" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">
        WIRED
      </text>
    </svg>
  );
}

// NYTimes logo
export function NYTimesLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
      <path d="M21.272 14.727h-1.09v-4.363h1.09V9.27h-1.09V6.545h-1.091v2.727h-1.636V6.545h-1.091v2.727H15v1.091h1.364v4.364H15v1.09h1.364v2.728h1.09v-2.727h1.637v2.727h1.09v-2.727h1.091v-1.091zM18 14.727h-1.636v-4.363H18v4.363zM12.545 6.545h-1.09v4.364H9.272V6.545H8.18v4.364h-.544c-.603 0-1.09.487-1.09 1.09v1.092h1.634v3.272c0 .604.488 1.091 1.091 1.091h2.182v-1.09H9.818c-.3 0-.546-.246-.546-.546v-2.727h3.273V10.91c0-.603-.488-1.09-1.09-1.09h-.546V6.544h1.636V6.545zM4.364 10.91h-.546V6.545H2.727v5.454c0 .604.488 1.091 1.091 1.091h.546v4.364h1.09V13.09h.546c.603 0 1.091-.488 1.091-1.091V6.545H5.455v4.364h-.546c-.15 0-.272-.123-.272-.273V10.364c0-.15.122-.273.272-.273h.546V9h-.546c-.753 0-1.364.61-1.364 1.364v.272c0 .151-.123.273-.273.273h.546z" />
    </svg>
  );
}

// Bloomberg logo
export function BloombergLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <rect fill="#000000" width="24" height="24" rx="2" />
      <text x="12" y="15" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="sans-serif">
        B
      </text>
    </svg>
  );
}

// WSJ logo
export function WSJLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <rect fill="#000000" width="24" height="24" rx="2" />
      <text x="12" y="15" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold" fontFamily="serif">
        WSJ
      </text>
    </svg>
  );
}

// WeChat logo
export function WeChatLogo({ className, style }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <rect fill="#07C160" width="24" height="24" rx="4" />
      <ellipse cx="9" cy="10.5" rx="5" ry="4" fill="white" />
      <ellipse cx="15" cy="13.5" rx="5" ry="4" fill="white" />
      <circle cx="7" cy="10" r="0.8" fill="#07C160" />
      <circle cx="11" cy="10" r="0.8" fill="#07C160" />
      <circle cx="13" cy="13" r="0.8" fill="#07C160" />
      <circle cx="17" cy="13" r="0.8" fill="#07C160" />
    </svg>
  );
}

// Brand configuration type
export interface BrandConfig {
  domains: string[];
  Logo: React.FC<LogoProps>;
  color: string;
  name: string;
}

// Brand logo registry
export const brandLogos: Record<string, BrandConfig> = {
  twitter: {
    domains: ["twitter.com", "x.com"],
    Logo: XLogo,
    color: "#000000",
    name: "X",
  },
  youtube: {
    domains: ["youtube.com", "youtu.be"],
    Logo: YouTubeLogo,
    color: "#FF0000",
    name: "YouTube",
  },
  gmail: {
    domains: ["mail.google.com"],
    Logo: GmailLogo,
    color: "#EA4335",
    name: "Gmail",
  },
  google: {
    domains: ["google.com", "docs.google.com", "drive.google.com"],
    Logo: GoogleLogo,
    color: "#4285F4",
    name: "Google",
  },
  ycombinator: {
    domains: ["ycombinator.com", "news.ycombinator.com"],
    Logo: YCombinatorLogo,
    color: "#FF6600",
    name: "Y Combinator",
  },
  hackernews: {
    domains: ["news.ycombinator.com"],
    Logo: HackerNewsLogo,
    color: "#FF6600",
    name: "Hacker News",
  },
  github: {
    domains: ["github.com", "gist.github.com"],
    Logo: GitHubLogo,
    color: "#181717",
    name: "GitHub",
  },
  reddit: {
    domains: ["reddit.com", "old.reddit.com"],
    Logo: RedditLogo,
    color: "#FF4500",
    name: "Reddit",
  },
  medium: {
    domains: ["medium.com"],
    Logo: MediumLogo,
    color: "#000000",
    name: "Medium",
  },
  linkedin: {
    domains: ["linkedin.com"],
    Logo: LinkedInLogo,
    color: "#0A66C2",
    name: "LinkedIn",
  },
  substack: {
    domains: ["substack.com"],
    Logo: SubstackLogo,
    color: "#FF6719",
    name: "Substack",
  },
  notion: {
    domains: ["notion.so", "notion.site"],
    Logo: NotionLogo,
    color: "#000000",
    name: "Notion",
  },
  spotify: {
    domains: ["spotify.com", "open.spotify.com"],
    Logo: SpotifyLogo,
    color: "#1DB954",
    name: "Spotify",
  },
  applepodcasts: {
    domains: ["podcasts.apple.com"],
    Logo: ApplePodcastsLogo,
    color: "#9933CC",
    name: "Apple Podcasts",
  },
  wikipedia: {
    domains: ["wikipedia.org", "en.wikipedia.org"],
    Logo: WikipediaLogo,
    color: "#000000",
    name: "Wikipedia",
  },
  arxiv: {
    domains: ["arxiv.org"],
    Logo: ArxivLogo,
    color: "#B31B1B",
    name: "arXiv",
  },
  anthropic: {
    domains: ["anthropic.com", "claude.ai"],
    Logo: AnthropicLogo,
    color: "#D4A27F",
    name: "Anthropic",
  },
  openai: {
    domains: ["openai.com", "chat.openai.com", "chatgpt.com"],
    Logo: OpenAILogo,
    color: "#10A37F",
    name: "OpenAI",
  },
  theinformation: {
    domains: ["theinformation.com"],
    Logo: TheInformationLogo,
    color: "#F04E5E",
    name: "The Information",
  },
  techcrunch: {
    domains: ["techcrunch.com"],
    Logo: TechCrunchLogo,
    color: "#0A9E01",
    name: "TechCrunch",
  },
  theverge: {
    domains: ["theverge.com"],
    Logo: TheVergeLogo,
    color: "#000000",
    name: "The Verge",
  },
  wired: {
    domains: ["wired.com"],
    Logo: WiredLogo,
    color: "#000000",
    name: "Wired",
  },
  nytimes: {
    domains: ["nytimes.com", "nyt.com"],
    Logo: NYTimesLogo,
    color: "#000000",
    name: "New York Times",
  },
  bloomberg: {
    domains: ["bloomberg.com"],
    Logo: BloombergLogo,
    color: "#000000",
    name: "Bloomberg",
  },
  wsj: {
    domains: ["wsj.com"],
    Logo: WSJLogo,
    color: "#000000",
    name: "Wall Street Journal",
  },
  wechat: {
    domains: ["mp.weixin.qq.com", "weixin.qq.com"],
    Logo: WeChatLogo,
    color: "#07C160",
    name: "WeChat",
  },
};

// Get brand config from URL
export function getBrandFromUrl(url?: string): BrandConfig | null {
  if (!url) return null;

  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");

    // Flatten all domains with their brands, sorted by domain length (longest first)
    // This ensures mail.google.com matches before google.com
    const allDomains: { domain: string; brand: BrandConfig }[] = [];
    for (const brand of Object.values(brandLogos)) {
      for (const domain of brand.domains) {
        allDomains.push({ domain, brand });
      }
    }
    allDomains.sort((a, b) => b.domain.length - a.domain.length);

    // First pass: exact matches only
    for (const { domain, brand } of allDomains) {
      if (hostname === domain) {
        return brand;
      }
    }

    // Second pass: subdomain matches
    for (const { domain, brand } of allDomains) {
      if (hostname.endsWith("." + domain)) {
        return brand;
      }
    }
  } catch {
    return null;
  }

  return null;
}
