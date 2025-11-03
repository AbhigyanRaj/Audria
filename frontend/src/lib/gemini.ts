import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini Flash AMD Service
 * Uses Google's Gemini 2.0 Flash model for real-time audio analysis
 */

export interface GeminiAMDConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AudioAnalysisResult {
  decision: 'human' | 'machine' | 'unknown';
  confidence: number;
  reasoning: string;
  latencyMs: number;
  metadata: {
    audioLength: number;
    voiceCharacteristics: string[];
    detectedPatterns: string[];
    originalDecision?: string;
    error?: string;
    [key: string]: any; // Allow additional fields
  };
}

/**
 * Initialize Gemini client
 */
export function createGeminiClient(config: GeminiAMDConfig) {
  if (!config.apiKey) {
    throw new Error('Gemini API key is required');
  }

  const genAI = new GoogleGenerativeAI(config.apiKey);
  return genAI.getGenerativeModel({ 
    model: config.model || 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: config.temperature || 0.1,
      maxOutputTokens: config.maxTokens || 200,
    },
  });
}

/**
 * Analyze audio buffer for AMD using Gemini Flash
 */
export async function analyzeAudioWithGemini(
  audioBuffer: Buffer,
  config: GeminiAMDConfig
): Promise<AudioAnalysisResult> {
  const startTime = Date.now();

  try {
    const model = createGeminiClient(config);

    // Convert audio buffer to base64
    const audioBase64 = audioBuffer.toString('base64');

    // PDF REQUIREMENTS: Greeting length detection
    const prompt = `
Analyze this audio to determine if answered by a HUMAN or VOICEMAIL MACHINE.

CRITICAL DETECTION RULES (from requirements):
1. SHORT GREETING (< 2 seconds, quick "hello" or similar) = HUMAN
   - Examples: "Hello?", "Yes?", "Hi", "Yeah"
   - Confidence: 85-95%

2. LONG GREETING (> 5 seconds, >5 words) = MACHINE (voicemail)
   - Examples: "Hi, you've reached John's voicemail. Please leave a message after the beep."
   - Typical voicemail phrases: "leave a message", "after the beep", "not available"
   - Confidence: 80-95%

3. SILENCE (3+ seconds, no speech) = TIMEOUT → Treat as HUMAN (safer)
   - Confidence: 50-60%

4. MEDIUM GREETING (2-5 seconds, 2-5 words) = Analyze carefully
   - Natural human greeting: "Hello, this is John" = HUMAN (70-80%)
   - Formal/robotic greeting: "Thank you for calling" = MACHINE (65-75%)

ANALYSIS STEPS:
1. Measure greeting duration (seconds)
2. Count approximate words spoken
3. Detect voicemail keywords: "message", "beep", "unavailable", "mailbox"
4. Analyze voice naturalness (conversational vs recorded)
5. Check for background noise (human = varied, machine = clean/silent)

Respond with JSON:
{
  "decision": "human" | "machine",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation",
  "greeting_duration_seconds": <number>,
  "estimated_word_count": <number>,
  "voiceCharacteristics": ["natural" | "robotic" | "recorded"],
  "detectedPatterns": ["voicemail_keywords" | "quick_response" | "silence" | etc]
}

IMPORTANT: 
- NEVER return "unknown" - always decide human or machine
- If uncertain, default to "human" (safer for customer experience)
- Be aggressive about detecting voicemail greetings (>5 words = machine)
`;

    // Prepare the content with audio
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'audio/wav',
          data: audioBase64,
        },
      },
      { text: prompt },
    ]);

    const response = await result.response;
    const text = response.text();

    // Parse the JSON response
    let analysisData;
    try {
      // Extract JSON from response (handle potential markdown formatting)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', text);
      
      // FALLBACK: Try to extract decision from text
      const textLower = text.toLowerCase();
      if (textLower.includes('machine') || textLower.includes('voicemail') || textLower.includes('answering')) {
        analysisData = {
          decision: 'machine',
          confidence: 0.65,
          reasoning: 'Detected machine/voicemail keywords in response',
          voiceCharacteristics: ['text_analysis'],
          detectedPatterns: ['machine_keywords']
        };
      } else if (textLower.includes('human') || textLower.includes('person') || textLower.includes('live')) {
        analysisData = {
          decision: 'human',
          confidence: 0.70,
          reasoning: 'Detected human keywords in response',
          voiceCharacteristics: ['text_analysis'],
          detectedPatterns: ['human_keywords']
        };
      } else {
        // Default to human (safer)
        analysisData = {
          decision: 'human',
          confidence: 0.55,
          reasoning: 'Unable to parse response, defaulting to human (safer)',
          voiceCharacteristics: ['parse_error'],
          detectedPatterns: ['default_fallback']
        };
      }
    }

    const latencyMs = Date.now() - startTime;
    
    // PDF REQUIREMENT: Never return unknown - always human or machine
    let decision: 'human' | 'machine' = analysisData.decision === 'machine' ? 'machine' : 'human';
    let confidence = Math.min(Math.max(analysisData.confidence || 0.5, 0), 1);
    
    // If decision was unknown, convert to human (safer per PDF)
    if (analysisData.decision === 'unknown' || analysisData.decision === 'uncertain') {
      decision = 'human';
      confidence = Math.max(confidence, 0.55);
      console.log('⚠️ Gemini uncertain, defaulting to human (safer per PDF)');
    }
    
    // Extract greeting analysis from Gemini
    const greetingDuration = analysisData.greeting_duration_seconds || 0;
    const wordCount = analysisData.estimated_word_count || 0;
    
    console.log(`📊 Gemini Analysis: ${decision} (${confidence})`);
    console.log(`   Greeting: ${greetingDuration}s, ~${wordCount} words`);
    console.log(`   Reasoning: ${analysisData.reasoning}`);

    return {
      decision,
      confidence,
      reasoning: analysisData.reasoning || 'No reasoning provided',
      latencyMs,
      metadata: {
        audioLength: audioBuffer.length,
        voiceCharacteristics: analysisData.voiceCharacteristics || [],
        detectedPatterns: analysisData.detectedPatterns || [],
        greeting_duration_seconds: greetingDuration,
        estimated_word_count: wordCount,
        originalDecision: analysisData.decision,
      },
    };
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    
    console.error('Gemini AMD analysis error:', error);
    
    // SMART FALLBACK: Use audio size to make educated guess
    const audioSize = audioBuffer.length;
    let decision: 'human' | 'machine' = 'human';
    let confidence = 0.55;
    let reasoning = '';
    
    if (audioSize > 40000) {
      // Large audio buffer = long greeting = likely voicemail
      decision = 'machine';
      confidence = 0.60;
      reasoning = `API error. Large audio (${audioSize} bytes) suggests long greeting/voicemail.`;
    } else if (audioSize < 15000) {
      // Small audio buffer = quick answer = likely human
      decision = 'human';
      confidence = 0.65;
      reasoning = `API error. Small audio (${audioSize} bytes) suggests quick human answer.`;
    } else {
      // Medium size - default to human (safer for customer experience)
      decision = 'human';
      confidence = 0.55;
      reasoning = `API error. Medium audio (${audioSize} bytes), defaulting to human (safer).`;
    }
    
    console.log(`⚠️ Gemini API failed, using size heuristic: ${decision} (${confidence})`);
    
    return {
      decision,
      confidence,
      reasoning,
      latencyMs,
      metadata: {
        audioLength: audioBuffer.length,
        voiceCharacteristics: ['api_error_fallback'],
        detectedPatterns: ['heuristic_size_based'],
        error: error.message,
      },
    };
  }
}

/**
 * Process real-time audio stream for AMD
 */
export class GeminiAMDProcessor {
  private config: GeminiAMDConfig;
  private audioChunks: Buffer[] = [];
  private analysisInProgress = false;
  private readonly maxAudioLength = 10000; // 10 seconds max
  private readonly minAudioLength = 2000;  // 2 seconds min

  constructor(config: GeminiAMDConfig) {
    this.config = config;
  }

  /**
   * Add audio chunk to buffer
   */
  addAudioChunk(chunk: Buffer): void {
    this.audioChunks.push(chunk);
    
    // Auto-analyze when we have enough audio
    const totalLength = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    if (totalLength >= this.minAudioLength && !this.analysisInProgress) {
      this.triggerAnalysis();
    }
  }

  /**
   * Trigger AMD analysis
   */
  private async triggerAnalysis(): Promise<AudioAnalysisResult | null> {
    if (this.analysisInProgress || this.audioChunks.length === 0) {
      return null;
    }

    this.analysisInProgress = true;

    try {
      // Combine audio chunks
      const combinedAudio = Buffer.concat(this.audioChunks);
      
      // Limit audio length
      const audioToAnalyze = combinedAudio.length > this.maxAudioLength 
        ? combinedAudio.subarray(0, this.maxAudioLength)
        : combinedAudio;

      const result = await analyzeAudioWithGemini(audioToAnalyze, this.config);
      
      // Clear processed chunks
      this.audioChunks = [];
      
      return result;
    } catch (error) {
      console.error('AMD analysis failed:', error);
      return null;
    } finally {
      this.analysisInProgress = false;
    }
  }

  /**
   * Force analysis of current buffer
   */
  async analyze(): Promise<AudioAnalysisResult | null> {
    return this.triggerAnalysis();
  }

  /**
   * Reset processor state
   */
  reset(): void {
    this.audioChunks = [];
    this.analysisInProgress = false;
  }
}

/**
 * Validate Gemini configuration
 */
export function validateGeminiConfig(config: Partial<GeminiAMDConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.apiKey) {
    errors.push('Gemini API key is required');
  } else if (!config.apiKey.startsWith('AIza')) {
    errors.push('Invalid Gemini API key format');
  }

  if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 1)) {
    errors.push('Temperature must be between 0 and 1');
  }

  if (config.maxTokens !== undefined && config.maxTokens < 50) {
    errors.push('Max tokens must be at least 50');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
