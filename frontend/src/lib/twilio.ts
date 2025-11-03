import twilio from 'twilio';

/**
 * Twilio Service Wrapper
 * Handles all Twilio API interactions for outbound calling and AMD
 */

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

export interface CallOptions {
  to: string;
  from: string;
  url: string;
  statusCallback?: string;
  statusCallbackEvent?: string[];
  machineDetection?: 'Enable' | 'DetectMessageEnd';
  asyncAmd?: boolean;
  asyncAmdStatusCallback?: string;
}

export interface CallResponse {
  sid: string;
  status: string;
  to: string;
  from: string;
  direction: string;
}

/**
 * Create Twilio client with credentials
 */
export function createTwilioClient(config: TwilioConfig) {
  if (!config.accountSid || !config.authToken) {
    throw new Error('Twilio credentials are required');
  }

  if (!config.accountSid.startsWith('AC')) {
    throw new Error('Invalid Twilio Account SID format');
  }

  return twilio(config.accountSid, config.authToken);
}

/**
 * Initiate an outbound call with AMD
 */
export async function initiateCall(
  config: TwilioConfig,
  options: CallOptions
): Promise<CallResponse> {
  try {
    const client = createTwilioClient(config);

    const callParams: any = {
      to: options.to,
      from: options.from,
      url: options.url,
    };

    if (options.statusCallback) {
      callParams.statusCallback = options.statusCallback;
    }
    if (options.statusCallbackEvent) {
      callParams.statusCallbackEvent = options.statusCallbackEvent;
    }
    if (options.machineDetection) {
      callParams.machineDetection = options.machineDetection;
    }
    if (options.asyncAmd !== undefined) {
      callParams.asyncAmd = options.asyncAmd;
    }
    if (options.asyncAmdStatusCallback) {
      callParams.asyncAmdStatusCallback = options.asyncAmdStatusCallback;
    }

    const call = await client.calls.create(callParams);

    return {
      sid: call.sid,
      status: call.status,
      to: call.to,
      from: call.from,
      direction: call.direction,
    };
  } catch (error: any) {
    // Handle Twilio-specific errors
    if (error.code === 21211) {
      throw new Error('Invalid phone number format');
    } else if (error.code === 21608) {
      throw new Error('Twilio phone number not found');
    } else if (error.code === 20003) {
      throw new Error('Authentication failed - check credentials');
    } else if (error.code === 21606) {
      throw new Error('Insufficient funds in Twilio account');
    }
    
    throw new Error(`Twilio API error: ${error.message}`);
  }
}

/**
 * Validate phone number format (E.164)
 */
export function validatePhoneNumber(phoneNumber: string): boolean {
  // E.164 format: +[country code][number]
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}

/**
 * Validate Twilio credentials format
 */
export function validateTwilioCredentials(config: Partial<TwilioConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.accountSid) {
    errors.push('Account SID is required');
  } else if (!config.accountSid.startsWith('AC') || config.accountSid.length !== 34) {
    errors.push('Invalid Account SID format (must start with AC and be 34 characters)');
  }

  if (!config.authToken) {
    errors.push('Auth Token is required');
  } else if (config.authToken.length !== 32) {
    errors.push('Invalid Auth Token format (must be 32 characters)');
  }

  if (!config.phoneNumber) {
    errors.push('Phone number is required');
  } else if (!validatePhoneNumber(config.phoneNumber)) {
    errors.push('Invalid phone number format (must be E.164 format, e.g., +12345678900)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Mask sensitive credentials for display
 */
export function maskCredentials(config: TwilioConfig): Partial<TwilioConfig> {
  return {
    accountSid: config.accountSid ? `${config.accountSid.slice(0, 8)}...${config.accountSid.slice(-4)}` : '',
    authToken: config.authToken ? '••••••••••••••••••••••••••••••••' : '',
    phoneNumber: config.phoneNumber,
  };
}
