import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@jiujipartner.com';
const ADMIN_PASSWORD = 'jiujipartner123';

// Movements are intentionally NOT seeded. The catalog is grown entirely from
// video imports: detected techniques become MovementSuggestions and only enter
// the Movement catalog when an admin approves them.

async function main() {
  const env = process.env.ENV ?? 'develop';

  // The convenience admin user exists only outside production. Production
  // admins are provisioned out-of-band — never from a hardcoded credential.
  if (env === 'production') {
    console.log('ENV=production — skipping admin user seed; nothing to seed.');
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      role: 'ADMIN',
      isVerified: true,
      firstName: 'Admin',
      lastName: 'JiuJi',
    },
  });

  console.log(`Seeded admin user: ${ADMIN_EMAIL} (ENV=${env})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
