import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { status, strategy, search, startDate, endDate } = body;

    // Build filter conditions
    const where: any = {
      userId: session.user.id,
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { targetNumber: { contains: search } },
        { callSid: { contains: search } },
      ];
    }

    if (startDate) {
      where.createdAt = {
        ...where.createdAt,
        gte: new Date(startDate),
      };
    }

    if (endDate) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(endDate),
      };
    }

    // Fetch all matching calls with AMD events
    const calls = await prisma.call.findMany({
      where,
      include: {
        amdEvents: strategy && strategy !== 'all' ? {
          where: { strategy }
        } : true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Convert to CSV format
    const csvHeaders = [
      'Call ID',
      'Call SID',
      'Target Number',
      'From Number',
      'Status',
      'Duration (seconds)',
      'Started At',
      'Ended At',
      'Created At',
      'AMD Strategy',
      'AMD Decision',
      'AMD Confidence',
      'AMD Latency (ms)',
    ];

    const csvRows = calls.flatMap(call => {
      if (call.amdEvents.length === 0) {
        // Call without AMD events
        return [[
          call.id,
          call.callSid,
          call.targetNumber,
          call.fromNumber,
          call.status,
          call.duration || '',
          call.startedAt?.toISOString() || '',
          call.endedAt?.toISOString() || '',
          call.createdAt.toISOString(),
          '',
          '',
          '',
          '',
        ]];
      }

      // Call with AMD events
      return call.amdEvents.map(amdEvent => [
        call.id,
        call.callSid,
        call.targetNumber,
        call.fromNumber,
        call.status,
        call.duration || '',
        call.startedAt?.toISOString() || '',
        call.endedAt?.toISOString() || '',
        call.createdAt.toISOString(),
        amdEvent.strategy,
        amdEvent.decision,
        amdEvent.confidence || '',
        amdEvent.latencyMs || '',
      ]);
    });

    // Generate CSV content
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => 
        row.map(field => 
          typeof field === 'string' && field.includes(',') 
            ? `"${field.replace(/"/g, '""')}"` 
            : field
        ).join(',')
      )
    ].join('\n');

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audria-calls-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });

  } catch (error) {
    console.error('Error exporting calls:', error);
    return NextResponse.json(
      { error: 'Failed to export calls' },
      { status: 500 }
    );
  }
}
