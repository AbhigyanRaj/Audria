/**
 * Audio Conversion Utilities
 * Converts Twilio Media Stream mulaw audio to formats suitable for AI models
 */

/**
 * Decode mulaw (μ-law) audio to PCM
 * Twilio sends audio in mulaw format, we need to convert to linear PCM
 */
export function mulawToPcm(mulawData: Buffer): Buffer {
  const pcmData = Buffer.alloc(mulawData.length * 2); // 16-bit PCM = 2 bytes per sample
  
  for (let i = 0; i < mulawData.length; i++) {
    const mulawByte = mulawData[i];
    const pcmSample = mulawDecode(mulawByte);
    pcmData.writeInt16LE(pcmSample, i * 2);
  }
  
  return pcmData;
}

/**
 * Decode a single mulaw byte to PCM sample
 * Based on ITU-T G.711 standard
 */
function mulawDecode(mulaw: number): number {
  mulaw = ~mulaw;
  const sign = (mulaw & 0x80);
  const exponent = (mulaw >> 4) & 0x07;
  const mantissa = mulaw & 0x0F;
  
  let sample = ((mantissa << 3) + 0x84) << exponent;
  if (sign !== 0) {
    sample = -sample;
  }
  
  return sample;
}

/**
 * Create WAV file header
 * Required for sending audio to Gemini API
 */
export function createWavHeader(
  dataLength: number,
  sampleRate: number = 8000,
  numChannels: number = 1,
  bitsPerSample: number = 16
): Buffer {
  const header = Buffer.alloc(44);
  
  // RIFF chunk descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4); // File size - 8
  header.write('WAVE', 8);
  
  // fmt sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28); // ByteRate
  header.writeUInt16LE(numChannels * bitsPerSample / 8, 32); // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34);
  
  // data sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  
  return header;
}

/**
 * Convert mulaw buffer to complete WAV file
 */
export function mulawToWav(mulawData: Buffer, sampleRate: number = 8000): Buffer {
  const pcmData = mulawToPcm(mulawData);
  const wavHeader = createWavHeader(pcmData.length, sampleRate);
  
  return Buffer.concat([wavHeader, pcmData]);
}

/**
 * Audio buffer manager for streaming
 * Accumulates audio chunks and provides WAV conversion
 */
export class AudioBufferManager {
  private chunks: Buffer[] = [];
  private totalBytes: number = 0;
  private readonly sampleRate: number;
  
  constructor(sampleRate: number = 8000) {
    this.sampleRate = sampleRate;
  }
  
  /**
   * Add audio chunk (mulaw format from Twilio)
   */
  addChunk(chunk: Buffer): void {
    this.chunks.push(chunk);
    this.totalBytes += chunk.length;
  }
  
  /**
   * Get current buffer size in bytes
   */
  getSize(): number {
    return this.totalBytes;
  }
  
  /**
   * Get duration in milliseconds
   */
  getDuration(): number {
    // mulaw: 8000 samples/sec, 1 byte per sample
    return (this.totalBytes / this.sampleRate) * 1000;
  }
  
  /**
   * Get combined audio as WAV file
   */
  getWav(): Buffer {
    if (this.chunks.length === 0) {
      return Buffer.alloc(0);
    }
    
    const combinedMulaw = Buffer.concat(this.chunks);
    return mulawToWav(combinedMulaw, this.sampleRate);
  }
  
  /**
   * Get combined audio as base64 WAV
   */
  getWavBase64(): string {
    return this.getWav().toString('base64');
  }
  
  /**
   * Clear buffer
   */
  clear(): void {
    this.chunks = [];
    this.totalBytes = 0;
  }
  
  /**
   * Check if buffer has minimum duration
   */
  hasMinimumDuration(minMs: number): boolean {
    return this.getDuration() >= minMs;
  }
}
