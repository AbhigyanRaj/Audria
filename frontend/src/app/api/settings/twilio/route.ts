import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';
import { validateTwilioCredentials, maskCredentials } from '@/lib/twilio';
import { encrypt, decrypt } from '@/lib/crypto';

const prisma = new PrismaClient();

/**
 * GET /api/settings/twilio
 * Fetch user's Twilio credentials (masked)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        twilioAccountSid: true,
        twilioAuthToken: true,
        twilioPhoneNumber: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // If no credentials saved
    if (!user.twilioAccountSid || !user.twilioAuthToken || !user.twilioPhoneNumber) {
      return NextResponse.json({
        configured: false,
        credentials: null,
      });
    }

    // Decrypt and mask credentials
    const decryptedConfig = {
      accountSid: decrypt(user.twilioAccountSid),
      authToken: decrypt(user.twilioAuthToken),
      phoneNumber: user.twilioPhoneNumber, // Phone number not encrypted
    };

    const maskedConfig = maskCredentials(decryptedConfig);

    return NextResponse.json({
      configured: true,
      credentials: maskedConfig,
    });
  } catch (error: any) {
    console.error('Error fetching Twilio credentials:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credentials' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/twilio
 * Save user's Twilio credentials (encrypted)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { accountSid, authToken, phoneNumber } = body;

    // Validate credentials format
    const validation = validateTwilioCredentials({
      accountSid,
      authToken,
      phoneNumber,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid credentials', details: validation.errors },
        { status: 400 }
      );
    }

    // Encrypt sensitive credentials
    const encryptedAccountSid = encrypt(accountSid);
    const encryptedAuthToken = encrypt(authToken);

    // Update user record
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twilioAccountSid: encryptedAccountSid,
        twilioAuthToken: encryptedAuthToken,
        twilioPhoneNumber: phoneNumber, // Store phone number as-is
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Twilio credentials saved successfully',
    });
  } catch (error: any) {
    console.error('Error saving Twilio credentials:', error);
    return NextResponse.json(
      { error: 'Failed to save credentials' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/twilio
 * Remove user's Twilio credentials
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twilioAccountSid: null,
        twilioAuthToken: null,
        twilioPhoneNumber: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Twilio credentials removed successfully',
    });
  } catch (error: any) {
    console.error('Error removing Twilio credentials:', error);
    return NextResponse.json(
      { error: 'Failed to remove credentials' },
      { status: 500 }
    );
  }
}
