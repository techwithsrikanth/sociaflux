import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { demoBusinesses, demoCreators, demoMatches } from "../src/lib/demo-data";

const prisma = new PrismaClient();

async function main() {
  for (const business of demoBusinesses) {
    await prisma.user.upsert({
      where: { email: business.user.email },
      update: {},
      create: {
        email: business.user.email,
        passwordHash: "dev-only-password-hash",
        role: UserRole.BUSINESS,
        business: {
          create: {
            name: business.name,
            website: business.website,
            country: business.country,
            language: business.language,
            profile: {
              create: business.profile as Prisma.BusinessProfileCreateWithoutBusinessInput
            },
            products: {
              create: business.products as Prisma.ProductCreateWithoutBusinessInput[]
            },
            campaigns: {
              create: business.campaigns as Prisma.CampaignCreateWithoutBusinessInput[]
            }
          }
        }
      }
    });
  }

  for (const creator of demoCreators) {
    await prisma.user.upsert({
      where: { email: creator.user.email },
      update: {},
      create: {
        email: creator.user.email,
        passwordHash: "dev-only-password-hash",
        role: UserRole.CREATOR,
        creator: {
          create: {
            name: creator.name,
            handle: creator.handle,
            website: creator.website,
            country: creator.country,
            language: creator.language,
            profile: {
              create: creator.profile as Prisma.CreatorProfileCreateWithoutCreatorInput
            },
            pricing: {
              create: creator.pricing as Prisma.CreatorPricingCreateWithoutCreatorInput
            }
          }
        }
      }
    });
  }

  console.log(`Seeded ${demoBusinesses.length} businesses and ${demoCreators.length} creators.`);
  console.log(`Sample match payloads available: ${demoMatches.length}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
