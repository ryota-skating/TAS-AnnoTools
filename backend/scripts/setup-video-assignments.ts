/**
 * Setup Video Assignments Script
 * Initial setup for 9 annotator accounts
 *
 * Usage:
 *   npx ts-node backend/scripts/setup-video-assignments.ts
 */

import { Database, setupDatabase } from '../src/services/database';
import { videoAssignmentService } from '../src/services/videoAssignmentService';
import { logger } from '../src/utils/logger';

interface PatternSetup {
  competition: string;
  gender: string;
  start: number;
  end: number;
}

interface BulkSetup {
  usernames: string[];
  patterns: PatternSetup[];
}

const ADMIN_ID = 'admin-default'; // Default admin user ID for created_by

// Assignment configuration based on user requirements
const ASSIGNMENTS: BulkSetup[] = [
  // Group 1: annotator1-3
  // Olympic Men #01 ~ Olympic Women #15 (45 videos)
  {
    usernames: ['annotator1', 'annotator2', 'annotator3'],
    patterns: [
      { competition: 'Olympic', gender: 'Men', start: 1, end: 30 },      // 30 videos
      { competition: 'Olympic', gender: 'Women', start: 1, end: 15 }     // 15 videos
    ]
  },

  // Group 2: annotator4-6
  // Olympic Women #16 ~ World Men #30 (45 videos)
  {
    usernames: ['annotator4', 'annotator5', 'annotator6'],
    patterns: [
      { competition: 'Olympic', gender: 'Women', start: 16, end: 30 },  // 15 videos
      { competition: 'World', gender: 'Men', start: 1, end: 30 }        // 30 videos
    ]
  },

  // Group 3: annotator7-9
  // World Men #31 ~ World Women #37 (44 videos)
  {
    usernames: ['annotator7', 'annotator8', 'annotator9'],
    patterns: [
      { competition: 'World', gender: 'Men', start: 31, end: 37 },      // 7 videos
      { competition: 'World', gender: 'Women', start: 1, end: 37 }      // 37 videos
    ]
  }
];

async function main() {
  try {
    console.log('='.repeat(80));
    console.log('TAS-AnnoTools: Video Assignment Setup');
    console.log('='.repeat(80));

    // Initialize database connection
    console.log('\n1. Connecting to database...');
    await setupDatabase();
    const database = Database.getInstance();

    console.log('   ✓ Database connected');

    // Verify admin user exists
    const admin = await database.get(
      'SELECT id, username FROM users WHERE id = ?',
      [ADMIN_ID]
    );

    if (!admin) {
      console.error('\n❌ Error: Default admin user not found');
      console.error('   Please ensure the database is properly initialized');
      process.exit(1);
    }

    console.log(`   ✓ Using admin account: ${admin.username}`);

    // Check if any assignments already exist
    const existingAssignments = await videoAssignmentService.getAllAssignments();
    if (existingAssignments.length > 0) {
      console.log(`\n⚠️  Warning: ${existingAssignments.length} existing assignments found`);
      console.log('   This script will create additional assignments');
      console.log('   To start fresh, delete existing assignments via admin API');
      console.log('');

      // Ask for confirmation (in real usage, you might want to implement readline)
      // For now, we'll just warn and continue
    }

    // Process each group
    console.log('\n2. Creating assignments...');
    let totalCreated = 0;
    const summary: { [username: string]: number } = {};

    for (let groupIndex = 0; groupIndex < ASSIGNMENTS.length; groupIndex++) {
      const group = ASSIGNMENTS[groupIndex];
      const groupNum = groupIndex + 1;

      console.log(`\n   Group ${groupNum}: ${group.usernames.join(', ')}`);

      for (const username of group.usernames) {
        // Look up user ID
        const user = await database.get(
          'SELECT id, username, role FROM users WHERE username = ?',
          [username]
        );

        if (!user) {
          console.warn(`   ⚠️  User not found: ${username} - skipping`);
          continue;
        }

        console.log(`      Processing ${username} (${user.role})...`);

        let userAssignmentCount = 0;

        // Create assignments for each pattern
        for (const pattern of group.patterns) {
          const assignment = await videoAssignmentService.createAssignment({
            userId: user.id,
            assignmentType: 'pattern',
            competition: pattern.competition,
            gender: pattern.gender,
            numberStart: pattern.start,
            numberEnd: pattern.end,
            createdBy: ADMIN_ID,
            notes: `Group ${groupNum}: ${pattern.competition} ${pattern.gender} #${pattern.start}-${pattern.end}`
          });

          const videoCount = pattern.end - pattern.start + 1;
          userAssignmentCount += videoCount;
          totalCreated++;

          console.log(`         ✓ ${pattern.competition} ${pattern.gender} #${pattern.start}-${pattern.end} (${videoCount} videos)`);
        }

        summary[username] = userAssignmentCount;
      }
    }

    // Display summary
    console.log('\n' + '='.repeat(80));
    console.log('Setup Complete!');
    console.log('='.repeat(80));
    console.log(`\nTotal assignment rules created: ${totalCreated}`);
    console.log('\nExpected video counts per annotator:');

    for (const [username, count] of Object.entries(summary)) {
      console.log(`   ${username.padEnd(15)} → ${count} videos`);
    }

    console.log('\nNote: Actual video counts depend on available video files.');
    console.log('Use the preview endpoint to verify assigned videos for each user.');
    console.log('\nExample:');
    console.log('   GET /api/video-assignments/preview/annotator1');

    // Close database connection
    await database.disconnect();

    console.log('\n✓ Script completed successfully');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    console.error('');
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run script
if (require.main === module) {
  main();
}
