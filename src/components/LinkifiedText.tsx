import React from 'react';

interface LinkifiedTextProps {
  text: string;
  isOutgoing?: boolean;
  className?: string;
}

// Regex to capture safe http://, https://, www., and common domains like youtube.com, google.com
const COMMON_TLDS = 'com|org|net|edu|gov|io|app|co|ai|me|dev|tv|info|biz|uk|ca|de|jp|fr|in|pk|ae|us|xyz';
const URL_REGEX = new RegExp(
  `(?:https?:\\/\\/[^\\s<>"'{}|\\\\^\`]+|\\bwww\\.[^\\s<>"'{}|\\\\^\`]+|\\b(?:[a-zA-Z0-9-]+\\.)+(?:${COMMON_TLDS})\\b(?:\\/[^\\s<>"'{}|\\\\^\`]*)?)`,
  'gi'
);

/**
 * Validates whether a detected URL candidate is a safe http or https URL.
 * Strictly prevents javascript:, data:, and other malicious schemes.
 */
function getSafeUrl(candidate: string): { href: string; displayText: string } | null {
  if (!candidate) return null;

  let displayText = candidate;
  let targetHref = candidate.trim();

  // Safely prepend https:// for www. or bare domain links
  if (!/^https?:\/\//i.test(targetHref)) {
    targetHref = `https://${targetHref}`;
  }

  // Security check: Only allow http and https protocols
  if (!/^https?:\/\//i.test(targetHref)) {
    return null;
  }

  // Strict check: Disallow javascript, data, vbscript, file
  if (/^(javascript|data|vbscript|file):/i.test(targetHref)) {
    return null;
  }

  try {
    const parsed = new URL(targetHref);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    // Ensure hostname is valid (has at least one dot or is localhost)
    if (!parsed.hostname || (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')) {
      return null;
    }
    return {
      href: parsed.href,
      displayText,
    };
  } catch {
    return null;
  }
}

/**
 * Strips trailing sentence punctuation (. , ; ! ? ) ] }) from a matched link candidate
 * so that URLs at the end of sentences (e.g., "Visit https://google.com.") don't include the period.
 */
function cleanUrlCandidate(rawCandidate: string): { cleanCandidate: string; trailingPunctuation: string } {
  let cleanCandidate = rawCandidate;
  let trailingPunctuation = '';

  const trailingPunctuationRegex = /[.,;:!?)]+$/;
  const match = cleanCandidate.match(trailingPunctuationRegex);
  if (match) {
    // If the candidate contains an opening parenthesis, preserve matching closing parenthesis
    const openParenCount = (cleanCandidate.match(/\(/g) || []).length;
    const closeParenCount = (cleanCandidate.match(/\)/g) || []).length;
    if (openParenCount === closeParenCount && cleanCandidate.endsWith(')')) {
      return { cleanCandidate, trailingPunctuation: '' };
    }

    trailingPunctuation = match[0];
    cleanCandidate = cleanCandidate.slice(0, -trailingPunctuation.length);
  }

  return { cleanCandidate, trailingPunctuation };
}

export const LinkifiedText: React.FC<LinkifiedTextProps> = ({
  text,
  isOutgoing = false,
  className = '',
}) => {
  if (!text) return null;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    const matchStart = match.index;
    const rawMatchedText = match[0];

    // Push plain text before this match
    if (matchStart > lastIndex) {
      elements.push(text.substring(lastIndex, matchStart));
    }

    const { cleanCandidate, trailingPunctuation } = cleanUrlCandidate(rawMatchedText);
    const safeResult = getSafeUrl(cleanCandidate);

    if (safeResult) {
      const linkClass = isOutgoing
        ? 'text-emerald-950 font-semibold underline underline-offset-2 hover:text-emerald-800 transition-colors break-all inline'
        : 'text-blue-600 font-semibold underline underline-offset-2 hover:text-blue-800 transition-colors break-all inline';

      elements.push(
        <a
          key={`link-${matchStart}`}
          href={safeResult.href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          onClick={(e) => e.stopPropagation()}
          title={`Open ${safeResult.displayText} in new tab`}
        >
          {safeResult.displayText}
        </a>
      );

      if (trailingPunctuation) {
        elements.push(trailingPunctuation);
      }
    } else {
      // If validation fails or was unsafe, render as normal plain text
      elements.push(rawMatchedText);
    }

    lastIndex = matchStart + rawMatchedText.length;
  }

  // Push remaining trailing text
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return <span className={className}>{elements}</span>;
};
