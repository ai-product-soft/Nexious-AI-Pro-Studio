const STRICT_VALIDATION_RULES = {
  // Brand leak check
  brandLeak: {
    forbidden: ['Mabishion AI', 'Mickii', 'Nexious AI', 'Mabishion', 'Nexious'],
    message: 'Client output mein tumhara brand nahi hona chahiye'
  },
  
  // Placeholder check
  placeholder: {
    patterns: [
      /\[insert.*?\]/gi,
      /\[client.*?\]/gi,
      /\[your.*?\]/gi,
      /lorem ipsum/gi,
      /placeholder/gi
    ],
    message: 'Placeholder text client ko nahi dikhna chahiye'
  },
  
  // Generic template check
  generic: {
    phrases: [
      'this project aims to',
      'leveraging our unique',
      'experienced development team',
      'high-quality websites'
    ],
    message: 'Generic marketing fluff hatao, client-specific content do'
  },
  
  // Context check
  context: {
    required: ['client_name', 'business_type', 'specific_features'],
    message: 'Client ka naam, business type, aur specific features hone chahiye'
  }
};

export function scanOutputForIssues(originalOutput, clientName) {
  if (!originalOutput) return ['Output is empty or undefined.'];
  
  const lowerOutput = originalOutput.toLowerCase();
  const redFlags = [];

  // 1. Brand leak check
  STRICT_VALIDATION_RULES.brandLeak.forbidden.forEach(brand => {
    // Check if the forbidden brand word exists case-insensitively
    const brandLower = brand.toLowerCase();
    if (lowerOutput.includes(brandLower)) {
      // Allow only safe system attributions like "powered by Mabishion AI" if explicitly permitted,
      // but otherwise treat any brand mention as a leak to client.
      const isAttribution = lowerOutput.includes(`powered by ${brandLower}`) || 
                            lowerOutput.includes(`built by ${brandLower}`) ||
                            lowerOutput.includes(`developed by ${brandLower}`);
      
      if (!isAttribution) {
        redFlags.push(`${STRICT_VALIDATION_RULES.brandLeak.message}: Found brand reference "${brand}"`);
      }
    }
  });

  // 2. Placeholder check
  STRICT_VALIDATION_RULES.placeholder.patterns.forEach(pattern => {
    if (pattern.test(originalOutput)) {
      redFlags.push(`${STRICT_VALIDATION_RULES.placeholder.message}: Matches pattern ${pattern.toString()}`);
      // Reset regex index for safety
      pattern.lastIndex = 0;
    }
  });

  // 3. Generic template phrase check
  STRICT_VALIDATION_RULES.generic.phrases.forEach(phrase => {
    if (lowerOutput.includes(phrase.toLowerCase())) {
      redFlags.push(`${STRICT_VALIDATION_RULES.generic.message}: Found generic fluff "${phrase}"`);
    }
  });

  // 4. Context check (Client Name, Business Type, and Specific Features)
  if (clientName) {
    const nameLower = clientName.toLowerCase();
    if (!lowerOutput.includes(nameLower)) {
      redFlags.push(`${STRICT_VALIDATION_RULES.context.message}: Client name "${clientName}" is missing from the output.`);
    }
  } else {
    redFlags.push(`${STRICT_VALIDATION_RULES.context.message}: client_name parameter is missing or empty.`);
  }

  // Check if business type is specified/detailed (look for words indicating business or domain)
  const businessKeywords = ['business', 'industry', 'market', 'commerce', 'services', 'retail', 'customer', 'sharma', 'shop', 'agency', 'app', 'website', 'brand'];
  const hasBusinessDetails = businessKeywords.some(keyword => lowerOutput.includes(keyword));
  if (!hasBusinessDetails) {
    redFlags.push(`${STRICT_VALIDATION_RULES.context.message}: Business type details are missing from the content.`);
  }

  // Check for specific features list or details (look for lists, bullet points, or heading structures)
  const hasFeaturesSection = lowerOutput.includes('feature') || lowerOutput.includes('requirement') || lowerOutput.includes('scope') || lowerOutput.includes('module');
  const hasBulletPoints = originalOutput.includes('-') || originalOutput.includes('*') || /[0-9]+\./.test(originalOutput);
  if (!hasFeaturesSection || !hasBulletPoints) {
    redFlags.push(`${STRICT_VALIDATION_RULES.context.message}: Specific features or functional requirements list is missing.`);
  }

  return redFlags;
}
