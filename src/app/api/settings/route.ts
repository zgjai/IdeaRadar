import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const allSettings = await db.query.settings.findMany();

    // Convert to key-value object
    const settingsObject: Record<string, string> = {};
    allSettings.forEach((s) => {
      settingsObject[s.key] = s.value;
    });

    return NextResponse.json({ settings: settingsObject });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.settings || typeof body.settings !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body. Expected { settings: {...} }' },
        { status: 400 }
      );
    }

    const updates: Array<{ key: string; value: string }> = [];

    // Update or insert each setting
    for (const [key, value] of Object.entries(body.settings)) {
      if (typeof value !== 'string') {
        return NextResponse.json(
          { error: `Setting value for "${key}" must be a string` },
          { status: 400 }
        );
      }

      // Check if setting exists
      const existing = await db.query.settings.findFirst({
        where: eq(settings.key, key),
      });

      if (existing) {
        await db
          .update(settings)
          .set({
            value,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(settings.key, key));
      } else {
        await db.insert(settings).values({
          key,
          value,
          updatedAt: new Date().toISOString(),
        });
      }

      updates.push({ key, value });
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updates.length} settings`,
      updates,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
