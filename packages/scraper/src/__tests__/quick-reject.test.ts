import { describe, it, expect } from 'vitest';

// Inline the quickReject function since it's not exported from phase2
function quickReject(job: { title: string; description: string }): string | null {
  const t = job.title.toLowerCase();
  const d = job.description.slice(0, 500).toLowerCase();

  const titleRejects = [
    'frontend', 'front-end', 'ios developer', 'android developer',
    'data scientist', 'machine learning engineer', 'ml engineer',
    'designer', 'ux ', 'product manager', 'sales ', 'recruiter',
    'marketing', 'finance', 'legal', 'devrel', 'developer advocate',
    'embedded', 'firmware', 'hardware', 'mechanical',
    'data analyst', 'analytics engineer', 'qa engineer', 'sdet',
    'test engineer', 'intern ', 'junior',
  ];
  for (const k of titleRejects) {
    if (t.includes(k)) return `Title exclude: ${k}`;
  }

  const wrongStack = [
    { keywords: ['java ', 'spring boot', 'jvm', 'kotlin'], label: 'Java/JVM' },
    { keywords: ['.net', 'c# ', 'asp.net', 'blazor'], label: '.NET/C#' },
    { keywords: ['ruby on rails', 'rails ', 'ruby '], label: 'Ruby/Rails' },
    { keywords: ['php ', 'laravel', 'symfony'], label: 'PHP' },
    { keywords: ['swift ', 'swiftui', 'uikit'], label: 'iOS/Swift' },
    { keywords: ['flutter', 'dart '], label: 'Flutter/Dart' },
  ];

  for (const stack of wrongStack) {
    const hits = stack.keywords.filter((k) => d.includes(k)).length;
    if (hits >= 2) return `Wrong stack: ${stack.label}`;
  }

  return null;
}

describe('quickReject', () => {
  describe('title-based rejections', () => {
    it('rejects frontend roles', () => {
      expect(quickReject({ title: 'Frontend Engineer', description: '' })).toContain('frontend');
    });

    it('rejects data scientists', () => {
      expect(quickReject({ title: 'Data Scientist', description: '' })).toContain('data scientist');
    });

    it('rejects product managers', () => {
      expect(quickReject({ title: 'Product Manager', description: '' })).toContain('product manager');
    });

    it('rejects junior roles', () => {
      expect(quickReject({ title: 'Junior Developer', description: '' })).toContain('junior');
    });

    it('rejects QA engineers', () => {
      expect(quickReject({ title: 'QA Engineer', description: '' })).toContain('qa engineer');
    });

    it('accepts backend engineer', () => {
      expect(quickReject({ title: 'Senior Backend Engineer', description: '' })).toBeNull();
    });

    it('accepts software engineer', () => {
      expect(quickReject({ title: 'Software Engineer', description: '' })).toBeNull();
    });

    it('accepts staff engineer', () => {
      expect(quickReject({ title: 'Staff Software Engineer', description: '' })).toBeNull();
    });

    it('accepts full stack', () => {
      expect(quickReject({ title: 'Full Stack Engineer', description: '' })).toBeNull();
    });
  });

  describe('stack-based rejections', () => {
    it('rejects Java-heavy descriptions', () => {
      const result = quickReject({
        title: 'Software Engineer',
        description: 'Experience with java spring boot and jvm required',
      });
      expect(result).toContain('Java/JVM');
    });

    it('rejects .NET descriptions', () => {
      const result = quickReject({
        title: 'Software Engineer',
        description: 'Strong c# and asp.net experience needed',
      });
      expect(result).toContain('.NET/C#');
    });

    it('accepts Node.js/TypeScript descriptions', () => {
      const result = quickReject({
        title: 'Software Engineer',
        description: 'Build services with Node.js, TypeScript, and MongoDB',
      });
      expect(result).toBeNull();
    });

    it('does not reject with only 1 stack signal', () => {
      const result = quickReject({
        title: 'Software Engineer',
        description: 'Some java experience helpful',
      });
      expect(result).toBeNull();
    });
  });
});
