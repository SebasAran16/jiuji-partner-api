import { PrismaClient, Belt } from '@prisma/client';

const prisma = new PrismaClient();

const movements = [
  { name: 'Armbar', slug: 'armbar', category: 'submission', type: 'joint_lock', minBelt: Belt.WHITE, gi: true },
  { name: 'Triangle Choke', slug: 'triangle-choke', category: 'submission', type: 'choke', minBelt: Belt.WHITE, gi: true },
  { name: 'Scissor Sweep', slug: 'scissor-sweep', category: 'sweep', type: 'guard_sweep', minBelt: Belt.WHITE, gi: true },
  { name: 'Kimura', slug: 'kimura', category: 'submission', type: 'joint_lock', minBelt: Belt.WHITE, gi: true },
  { name: 'Guillotine Choke', slug: 'guillotine-choke', category: 'submission', type: 'choke', minBelt: Belt.WHITE, gi: false },
  { name: 'Hip Bump Sweep', slug: 'hip-bump-sweep', category: 'sweep', type: 'guard_sweep', minBelt: Belt.WHITE, gi: true },
  { name: 'Rear Naked Choke', slug: 'rear-naked-choke', category: 'submission', type: 'choke', minBelt: Belt.WHITE, gi: false },
  { name: 'Knee Slice Pass', slug: 'knee-slice-pass', category: 'guard_pass', type: 'pass', minBelt: Belt.BLUE, gi: true },
  { name: 'Double Leg Takedown', slug: 'double-leg-takedown', category: 'takedown', type: 'takedown', minBelt: Belt.WHITE, gi: false },
  { name: 'Bridge and Roll Escape', slug: 'bridge-and-roll-escape', category: 'escape', type: 'mount_escape', minBelt: Belt.WHITE, gi: true },
];

async function main() {
  console.log('Seeding movements...');

  for (const movement of movements) {
    await prisma.movement.upsert({
      where: { slug: movement.slug },
      update: {},
      create: movement,
    });
  }

  console.log(`Seeded ${movements.length} movements`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
