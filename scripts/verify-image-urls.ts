import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CLOUDFRONT_DOMAIN = 'd3ts7f6tq8vpfi.cloudfront.net';

async function verifyUrls() {
  const products = await prisma.product.findMany();
  
  let cloudfrontCount = 0;
  let s3Count = 0;
  let missingImageCount = 0;

  for (const product of products) {
    let hasCloudfront = false;
    let hasS3 = false;

    const checkUrl = (url: string | null | undefined) => {
      if (!url) return;
      if (url.includes(CLOUDFRONT_DOMAIN)) hasCloudfront = true;
      else if (url.includes('.s3.') && url.includes('amazonaws.com')) hasS3 = true;
    };

    const checkArray = (urls: string[] | null | undefined) => {
      if (urls && Array.isArray(urls)) urls.forEach(checkUrl);
    };

    checkUrl(product.image);
    checkUrl(product.thumbnail);
    checkUrl(product.cartonLabel);
    checkUrl(product.machineArtwork);
    checkUrl(product.qrCode);

    checkArray(product.images);
    checkArray(product.mrpStickers);
    checkArray(product.customDeclarations);
    checkArray(product.brochure);

    if (!product.image && (!product.images || product.images.length === 0)) {
      missingImageCount++;
    }

    if (hasCloudfront) cloudfrontCount++;
    if (hasS3) s3Count++;
  }

  console.log(`Products using CloudFront URLs: ${cloudfrontCount}`);
  console.log(`Products using S3 URLs: ${s3Count}`);
  console.log(`Products with missing images: ${missingImageCount}`);
}

verifyUrls()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
