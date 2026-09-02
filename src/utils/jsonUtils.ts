/**
 * Safe and Robust JSON Parser for AI Outputs
 * Handles:
 * - Direct JSON
 * - Markdown code blocks (```json ... ```)
 * - Trailing text or commentary after JSON (e.g. line 69 non-whitespace character after JSON)
 * - Leading text or commentary before JSON
 * - Trailing commas before } or ]
 * - Unescaped control characters
 * - Truncated JSON structures
 */

/**
 * Strips invisible control characters (except standard whitespace \r, \n, \t)
 */
export function cleanControlCharacters(str: string): string {
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Sanitizes minor JSON defects such as trailing commas and unquoted keys
 */
export function sanitizeJsonString(str: string): string {
  return cleanControlCharacters(str)
    // Remove trailing commas before } or ]
    .replace(/,\s*([}\]])/g, '$1')
    // Fix unquoted property names like { foo: "bar" }
    .replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":');
}

/**
 * Extracts a balanced JSON substring starting at the first '{' or '['
 * and ending at the matching outermost '}' or ']'.
 * Ignores brackets inside quoted strings.
 */
export function extractBalancedJsonString(text: string): string | null {
  if (!text) return null;

  let firstBrace = -1;
  let firstBracket = -1;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '{' && firstBrace === -1) firstBrace = i;
    if (char === '[' && firstBracket === -1) firstBracket = i;
    if (firstBrace !== -1 && firstBracket !== -1) break;
  }

  if (firstBrace === -1 && firstBracket === -1) return null;

  let startIdx = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
  } else {
    startIdx = firstBracket;
  }

  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      if (inString) {
        escape = true;
      }
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack.length > 0 && stack[stack.length - 1] === '{') {
          stack.pop();
          if (stack.length === 0) {
            return text.substring(startIdx, i + 1);
          }
        }
      } else if (char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === '[') {
          stack.pop();
          if (stack.length === 0) {
            return text.substring(startIdx, i + 1);
          }
        }
      }
    }
  }

  return null;
}

/**
 * Attempts to repair and close a truncated JSON string
 */
export function repairTruncatedJsonString(text: string): string | null {
  if (!text) return null;

  const startIdx = text.search(/[\{\[]/);
  if (startIdx === -1) return null;

  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      if (inString) escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}' && stack.length > 0 && stack[stack.length - 1] === '{') {
        stack.pop();
      } else if (char === ']' && stack.length > 0 && stack[stack.length - 1] === '[') {
        stack.pop();
      }
    }
  }

  if (stack.length === 0) return null;

  let repaired = text.substring(startIdx);
  if (inString) {
    repaired += '"';
  }
  // Remove trailing comma
  repaired = repaired.replace(/,\s*$/, '');

  // Close remaining open brackets in reverse order
  while (stack.length > 0) {
    const open = stack.pop();
    if (open === '{') repaired += '}';
    else if (open === '[') repaired += ']';
  }

  return sanitizeJsonString(repaired);
}

/**
 * Universal safe JSON extractor and parser.
 * Returns parsed object/array of type T or null if unparseable.
 */
export function extractAndParseJson<T = any>(input: any): T | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'object') return input as T;
  if (typeof input !== 'string') return null;

  const text = input.trim();
  if (!text) return null;

  // 1. Direct parse attempt
  try {
    return JSON.parse(text);
  } catch (_) {}

  // 2. Markdown code block extraction
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let codeMatch: RegExpExecArray | null;
  while ((codeMatch = codeBlockRegex.exec(text)) !== null) {
    const blockContent = codeMatch[1].trim();
    try {
      return JSON.parse(blockContent);
    } catch (_) {
      const extracted = extractBalancedJsonString(blockContent);
      if (extracted) {
        try {
          return JSON.parse(extracted);
        } catch (_) {
          try {
            return JSON.parse(sanitizeJsonString(extracted));
          } catch (_) {}
        }
      }
    }
  }

  // 3. Balanced JSON structure extraction (handles extra text before or AFTER the JSON)
  const balanced = extractBalancedJsonString(text);
  if (balanced) {
    try {
      return JSON.parse(balanced);
    } catch (_) {
      try {
        return JSON.parse(sanitizeJsonString(balanced));
      } catch (_) {}
    }
  }

  // 4. Try repair if truncated
  const repaired = repairTruncatedJsonString(text);
  if (repaired) {
    try {
      return JSON.parse(repaired);
    } catch (_) {}
  }

  // 5. Outermost regex match fallback
  try {
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch (_) {
        return JSON.parse(sanitizeJsonString(objMatch[0]));
      }
    }
  } catch (_) {}

  try {
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        return JSON.parse(arrMatch[0]);
      } catch (_) {
        return JSON.parse(sanitizeJsonString(arrMatch[0]));
      }
    }
  } catch (_) {}

  return null;
}
