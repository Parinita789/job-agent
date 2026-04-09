import { Injectable, NotFoundException } from '@nestjs/common';
import { UserModel, getOllamaClient, getAnthropicClient } from '@job-agent/shared';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

@Injectable()
export class ProfileService {
  async getProfile(): Promise<any> {
    const user = await UserModel.findOne().lean();
    if (!user) throw new NotFoundException('No profile found. Upload a resume to create one.');
    return user;
  }

  async updateProfile(profile: any): Promise<any> {
    profile.meta = {
      ...profile.meta,
      last_updated: new Date().toISOString().split('T')[0],
    };

    const updated = await UserModel.findOneAndUpdate(
      {},
      { $set: profile },
      { upsert: true, new: true },
    ).lean();

    return updated;
  }

  async parseResumeAndCreateProfile(fileBuffer: Buffer): Promise<any> {
    console.log('[Resume] Starting PDF parse...');

    let resumeText: string;
    try {
      const pdf = await pdfParse(fileBuffer);
      resumeText = pdf.text;
      console.log(`[Resume] Extracted ${resumeText.length} chars from PDF`);
    } catch (err) {
      console.error('[Resume] PDF parse failed:', (err as Error).message);
      throw new Error(`Failed to read PDF: ${(err as Error).message}`);
    }

    if (!resumeText || resumeText.length < 50) {
      throw new Error('Could not extract text from PDF');
    }

    const prompt = `Extract a structured candidate profile from this resume. Return ONLY valid JSON matching this exact schema — no other text, no markdown, no explanation:

{
  "meta": { "version": "1.0", "last_updated": "${new Date().toISOString().split('T')[0]}" },
  "personal": {
    "name": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "github": ""
  },
  "experience": {
    "total_years": 0,
    "current_level": "",
    "summary": ""
  },
  "skills": {
    "languages": [],
    "frameworks": [],
    "databases": [],
    "messaging": [],
    "cloud": [],
    "devops": [],
    "architecture": [],
    "ai": [],
    "tools": [],
    "methodologies": []
  },
  "top_achievements": [{ "company": "", "impact": "" }],
  "work_history": [{ "company": "", "location": "", "title": "", "start": "YYYY-MM", "end": "YYYY-MM or present", "duration_years": 0 }],
  "preferences": {
    "target_roles": [],
    "location": {
      "current_city": "",
      "remote": true,
      "hybrid_us": true,
      "onsite": true,
      "international_remote": false
    },
    "employment_type": ["full-time"],
    "visa_sponsorship_required": false,
    "company_size": { "growth_startup": true, "mid_size": true, "enterprise": true, "early_startup": false },
    "excluded_industries": [],
    "preferred_domains": []
  },
  "compensation": {
    "currency": "USD",
    "base_salary_min": 0,
    "base_salary_preferred": 0,
    "equity": "open to discussing",
    "notes": ""
  },
  "deal_breakers": [],
  "strengths_for_agent": {
    "use_for_cover_letter": [],
    "ats_keywords": []
  }
}

Rules:
- Extract ALL skills mentioned and categorize them correctly
- Calculate total_years from work history dates
- For top_achievements, pick 2-4 most impactful bullet points with quantified results
- For current_level, infer from most recent job title
- Summary should be 1-2 sentences about their specialization
- target_roles should be realistic next roles based on experience
- ats_keywords should include the most important technical terms from the resume
- use_for_cover_letter should be 3-5 key strengths/achievements
- preferred_domains should be inferred from work history industries
- Leave compensation fields as 0 (user will fill in)
- Set location fields based on the resume's listed location

Resume:
${resumeText.slice(0, 8000)}`;

    // ── Ollama (local LLM) ──
    console.log('[Resume] Sending to LLM for parsing...');
    let res;
    try {
      res = await getOllamaClient().chat.completions.create({
      model: 'llama3:latest',
      messages: [
        { role: 'system', content: 'You are a JSON-only assistant. Always respond with valid JSON. No explanations, no markdown, no preamble.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });
    } catch (err) {
      console.error('[Resume] LLM call failed:', (err as Error).message);
      throw new Error(`LLM connection failed: ${(err as Error).message}. Is Ollama running?`);
    }
    const responseText = res.choices[0].message.content!.trim();
    console.log(`[Resume] LLM response: ${responseText.length} chars`);

    // ── Claude API (commented out) ──
    // const message = await anthropic.messages.create({
    //   model: 'claude-sonnet-4-6',
    //   max_tokens: 2000,
    //   messages: [{ role: 'user', content: prompt }],
    // });
    // const responseText = (message.content[0] as any).text.trim();

    // Extract JSON from response — handle markdown blocks, preamble text, etc.
    let jsonStr = responseText;

    // Try markdown code block first
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    } else {
      // Find the first { and last } to extract JSON object
      const firstBrace = responseText.indexOf('{');
      const lastBrace = responseText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = responseText.slice(firstBrace, lastBrace + 1);
      }
    }

    let profile;
    try {
      profile = JSON.parse(jsonStr);
    } catch {
      console.error('Failed to parse LLM response as JSON. Raw response:', responseText.slice(0, 500));
      throw new Error('LLM returned invalid JSON. Try uploading again.');
    }

    // Save to DB
    console.log('[Resume] Saving profile to database...');
    const saved = await UserModel.findOneAndUpdate(
      {},
      { $set: profile },
      { upsert: true, new: true },
    ).lean();

    return saved;
  }
}
