import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * GET /api/calls
 * Fetch call history with filters and pagination
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

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const status = searchParams.get('status');
    const strategy = searchParams.get('strategy');
    const search = searchParams.get('search');

    // Build where clause
    const where: any = {
      userId: session.user.id,
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { callSid: { contains: search, mode: 'insensitive' } },
        { targetNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    // If strategy filter is applied, we need to join with AMDEvent
    let calls;
    let total;

    if (strategy && strategy !== 'all') {
      // Filter by AMD strategy
      calls = await prisma.call.findMany({
        where: {
          ...where,
          amdEvents: {
            some: {
              strategy,
            },
          },
        },
        include: {
          amdEvents: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      });

      total = await prisma.call.count({
        where: {
          ...where,
          amdEvents: {
            some: {
              strategy,
            },
          },
        },
      });
    } else {
      // No strategy filter
      calls = await prisma.call.findMany({
        where,
        include: {
          amdEvents: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      });

      total = await prisma.call.count({ where });
    }

    // Format response
    const formattedCalls = calls.map(call => {
      const amdEvent = call.amdEvents[0]; // Get first AMD event
      
      return {
        id: call.id,
        callSid: call.callSid,
        targetNumber: call.targetNumber,
        fromNumber: call.fromNumber,
        status: call.status,
        duration: call.duration,
        strategy: amdEvent?.strategy || 'unknown',
        detection: amdEvent?.detection || 'pending',
        confidence: amdEvent?.confidence,
        latencyMs: amdEvent?.latencyMs,
        metadata: amdEvent?.metadata, // Include metadata for UI display
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        createdAt: call.createdAt,
      };
    });

    return NextResponse.json({
      calls: formattedCalls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching calls:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calls' },
      { status: 500 }
    );
  }
}
