const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const business = await prisma.business.findFirst();
  if (!business) {
    console.log('No business found. Create one first.');
    return;
  }

  const businessId = business.id;
  console.log(`Seeding analytics for business ${businessId}...`);

  await prisma.analytic.deleteMany({
    where: { businessId }
  });

  const metrics = [
    { metricType: 'TOTAL_CHATS', value: Math.floor(Math.random() * 50) + 10 },
    { metricType: 'POPULAR_TOPICS', value: Math.floor(Math.random() * 100) + 20 },
    { metricType: 'FAILED_RESPONSES', value: Math.floor(Math.random() * 5) },
    { metricType: 'RESOLUTION_RATE', value: Math.floor(Math.random() * 30) + 60 }, // 60-90%
    { metricType: 'AVERAGE_SESSION_DURATION', value: Math.floor(Math.random() * 300) + 60 }, // seconds
  ];

  for (const m of metrics) {
    await prisma.analytic.create({
      data: {
        businessId,
        metricType: m.metricType,
        metricValue: m.value,
        date: new Date(),
      }
    });
  }



  console.log('Seeded successfully!');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
