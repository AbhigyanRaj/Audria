/**
 * FastAPI AMD Microservice Integration
 * Connects Next.js backend with Python FastAPI ML service
 */

export interface FastAPIAMDConfig {
  baseUrl?: string;
  timeout?: number;
}

export interface FastAPIAnalysisRequest {
  audio_data: string; // base64 encoded
  sample_rate: number;
  model_type: 'wav2vec2' | 'whisper' | 'vad' | 'ensemble';
}

export interface FastAPIAnalysisResponse {
  detection: 'human' | 'machine' | 'unknown';
  confidence: number;
  latency_ms: number;
  model_used: string;
  reasoning: string;
  metadata: {
    transcription?: string;
    voice_ratio?: number;
    individual_results?: any[];
    detection_scores?: Record<string, number>;
    error?: string;
    fallback?: boolean;
  };
}

export interface FastAPIHealthResponse {
  status: string;
  models_loaded: number;
  active_sessions: number;
  timestamp: number;
}

/**
 * Default configuration for FastAPI AMD service
 */
const DEFAULT_CONFIG: FastAPIAMDConfig = {
  baseUrl: process.env.FASTAPI_AMD_URL || 'http://localhost:8001',
  timeout: 30000, // 30 seconds
};

/**
 * FastAPI AMD Service Client
 */
export class FastAPIAMDService {
  private config: FastAPIAMDConfig;

  constructor(config: FastAPIAMDConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if FastAPI service is healthy
   */
  async healthCheck(): Promise<FastAPIHealthResponse> {
    const response = await fetch(`${this.config.baseUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.config.timeout || 30000),
    });

    if (!response.ok) {
      throw new Error(`FastAPI health check failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get available models
   */
  async getModels(): Promise<any> {
    const response = await fetch(`${this.config.baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.config.timeout || 30000),
    });

    if (!response.ok) {
      throw new Error(`Failed to get models: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Analyze audio using FastAPI ML models
   */
  async analyzeAudio(
    audioBuffer: Buffer,
    options: {
      sampleRate?: number;
      modelType?: 'wav2vec2' | 'whisper' | 'vad' | 'ensemble';
    } = {}
  ): Promise<FastAPIAnalysisResponse> {
    const { sampleRate = 8000, modelType = 'ensemble' } = options;

    // Convert audio buffer to base64
    const audioBase64 = audioBuffer.toString('base64');

    const requestData: FastAPIAnalysisRequest = {
      audio_data: audioBase64,
      sample_rate: sampleRate,
      model_type: modelType,
    };

    const response = await fetch(`${this.config.baseUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
      signal: AbortSignal.timeout(this.config.timeout || 30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FastAPI analysis failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get active streaming sessions
   */
  async getSessions(): Promise<any> {
    const response = await fetch(`${this.config.baseUrl}/sessions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.config.timeout || 30000),
    });

    if (!response.ok) {
      throw new Error(`Failed to get sessions: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Create WebSocket connection for streaming
   */
  createWebSocketConnection(callSid: string): WebSocket {
    const wsUrl = `${this.config.baseUrl?.replace('http', 'ws')}/stream/${callSid}`;
    return new WebSocket(wsUrl);
  }
}

/**
 * Default FastAPI AMD service instance
 */
export const fastAPIAMDService = new FastAPIAMDService();

/**
 * Analyze audio with FastAPI AMD service
 */
export async function analyzeAudioWithFastAPI(
  audioBuffer: Buffer,
  config: FastAPIAMDConfig & {
    sampleRate?: number;
    modelType?: 'wav2vec2' | 'whisper' | 'vad' | 'ensemble';
  } = {}
): Promise<FastAPIAnalysisResponse> {
  const service = new FastAPIAMDService(config);
  
  try {
    // Check service health first
    await service.healthCheck();
    
    // Analyze audio
    const result = await service.analyzeAudio(audioBuffer, {
      sampleRate: config.sampleRate || 8000,
      modelType: config.modelType || 'ensemble',
    });
    
    return result;
  } catch (error) {
    console.error('FastAPI AMD analysis failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Fallback response
    return {
      detection: 'unknown',
      confidence: 0.5,
      latency_ms: 0,
      model_used: 'fastapi_fallback',
      reasoning: `FastAPI service unavailable: ${errorMessage}`,
      metadata: {
        error: errorMessage,
        fallback: true,
      },
    };
  }
}
