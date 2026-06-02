import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});
const bucketName = process.env.AWS_S3_BUCKET || 'probodyline-uploads';

async function migrate() {
  console.log('Starting image migration to S3...');
  const products = await prisma.product.findMany();
  let migratedCount = 0;

  for (const product of products) {
    let updated = false;
    const dataToUpdate: any = {};

    // Helper to migrate a single image path
    const migrateImage = async (imagePath: string, isThumbnail = false) => {
      if (!imagePath || imagePath.startsWith('http') || imagePath.startsWith('data:')) return null;
      
      const fullPath = path.join(process.cwd(), imagePath);
      if (!fs.existsSync(fullPath)) {
        console.warn(`File not found: ${fullPath}`);
        return null;
      }

      const buffer = fs.readFileSync(fullPath);
      const filename = path.basename(imagePath);
      const baseFilename = filename.replace(/\.[^/.]+$/, "");
      
      const key = `migrated/${baseFilename}${isThumbnail ? '_thumb' : ''}.webp`;
      
      const s = sharp(buffer);
      if (isThumbnail) {
        s.resize(200, 200, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 70 });
      } else {
        s.resize(800, 800, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 });
      }
      
      const processedBuffer = await s.toBuffer();
      
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: processedBuffer,
        ContentType: 'image/webp'
      }));

      return `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    };

    const generateLQIP = async (imagePath: string) => {
      if (!imagePath || imagePath.startsWith('http') || imagePath.startsWith('data:')) return null;
      const fullPath = path.join(process.cwd(), imagePath);
      if (!fs.existsSync(fullPath)) return null;
      
      const buffer = fs.readFileSync(fullPath);
      const lqipBuffer = await sharp(buffer).resize(8, 8, { fit: 'inside' }).webp({ quality: 20 }).toBuffer();
      return `data:image/webp;base64,${lqipBuffer.toString('base64')}`;
    };

    // Migrate main image
    if (product.image && !product.image.startsWith('http')) {
      const newUrl = await migrateImage(product.image, false);
      if (newUrl) {
        dataToUpdate.image = newUrl;
        updated = true;
      }
    }

    // Migrate thumbnail and generate LQIP
    const sourceThumbPath = product.thumbnail || product.image;
    if (sourceThumbPath && !sourceThumbPath.startsWith('http')) {
      const newThumbUrl = await migrateImage(sourceThumbPath, true);
      const newLqip = await generateLQIP(sourceThumbPath);
      
      if (newThumbUrl) {
        dataToUpdate.thumbnail = newThumbUrl;
        updated = true;
      }
      if (newLqip && !product.lqip) {
        dataToUpdate.lqip = newLqip;
        updated = true;
      }
    }

    if (updated) {
      await prisma.product.update({
        where: { id: product.id },
        data: dataToUpdate
      });
      migratedCount++;
      console.log(`Migrated product: ${product.modelNumber}`);
    }
  }

  console.log(`Migration complete. Updated ${migratedCount} products.`);
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
