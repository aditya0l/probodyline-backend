import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generate placeholder image using SVG data URI
 * Works in Node.js environment (for seed script)
 */
function generatePlaceholderImage(
  text: string,
  width: number = 800,
  height: number = 600,
  backgroundColor: string = "#FF6B35",
  textColor: string = "#FFFFFF"
): string {
  // Escape text for XML/SVG
  const escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  // Calculate font size based on text length and image dimensions
  const baseFontSize = Math.min(width / 20, height / 15, 24);
  const fontSize = Math.max(12, baseFontSize);

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${backgroundColor}"/>
      <text 
        x="50%" 
        y="50%" 
        font-family="Arial, sans-serif" 
        font-size="${fontSize}" 
        fill="${textColor}" 
        text-anchor="middle" 
        dominant-baseline="middle"
        font-weight="500"
      >${escapedText}</text>
    </svg>
  `.trim();

  // Encode SVG to base64 data URI (Node.js environment)
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function main() {
  console.log('🌱 Starting seed...');

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {
      logo: '/public/logo.png',
      bankDetails: `Bank Name - Axis Bank,
A/C Name - Creative Enterprises,
A/C No. - 916030039099739,
Ifsc Code - UTIB0002982,
Micr Code - 302211017,
Branch - Sitapura, Jaipur`,
    },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'CREATIVE ENTERPRISES',
      address: 'F-1293, PHASE 3, RIICO INDUSTRIAL AREA\nRAMCHANDRAPURA SITAPURA, JAIPUR-302022',
      gst: '08AAFFC7098H1Z3',
      phone: '0141-2771521, 0141-2771621',
      email: '1293creative@gmail.com',
      website: 'www.probodyline.com',
      contactPerson: 'Mr. TARUN (7240412345)',
      logo: '/public/logo.png',
      defaultGstRate: 18,
      bankDetails: `Bank Name - Axis Bank,
A/C Name - Creative Enterprises,
A/C No. - 916030039099739,
Ifsc Code - UTIB0002982,
Micr Code - 302211017,
Branch - Sitapura, Jaipur`,
    },
  });

  console.log('✅ Created organization:', org.name);

  // Create some default categories
  const categories = [
    { name: 'Cardio Equipment', description: 'Cardiovascular exercise equipment' },
    { name: 'Strength Equipment', description: 'Strength training equipment' },
    { name: 'Free Weights', description: 'Free weights and accessories' },
    { name: 'Functional Training', description: 'Functional training equipment' },
    { name: 'Accessories', description: 'Fitness accessories' },
  ];

  const createdCategories: Array<{ id: string; name: string }> = [];
  for (const category of categories) {
    const created = await prisma.category.upsert({
      where: {
        name: category.name,
      },
      update: {},
      create: {
        name: category.name,
        description: category.description,
      },
    });
    createdCategories.push(created);
  }

  console.log(`✅ Created ${categories.length} categories`);

  // Get category IDs for product linking
  const cardioCategory = createdCategories.find(c => c.name === 'Cardio Equipment');
  const strengthCategory = createdCategories.find(c => c.name === 'Strength Equipment');
  const functionalCategory = createdCategories.find(c => c.name === 'Functional Training');

  // Create 15 diverse products for testing
  const products = [
    {
      name: 'Probodyline Treadmill Pro 5000',
      modelNumber: 'PB-TM-5000',
      categoryId: cardioCategory?.id,
      productType: 'Cardio',
      seriesName: 'Professional Series',
      price: 450000,
      priority: 5,
      todaysStock: 12,
      stockPlus360Days: 45,
      brand: 'Probodyline',
      warranty: '2 years manufacturer warranty',
      keyword: ['treadmill', 'cardio', 'running', 'fitness', 'professional'],
      packagingDescription: ['Fully Assembled', 'Boxed with Manual'],
      notes: 'Commercial grade treadmill with 5HP motor, 22" running surface, and advanced console with heart rate monitoring.',
      image: generatePlaceholderImage('Probodyline Treadmill Pro 5000'),
      images: [
        generatePlaceholderImage('Treadmill Front View'),
        generatePlaceholderImage('Treadmill Console'),
        generatePlaceholderImage('Treadmill Side View'),
      ],
    },
    {
      name: 'Probodyline Elliptical Trainer Elite',
      modelNumber: 'PB-EL-3000',
      categoryId: cardioCategory?.id,
      productType: 'Cardio',
      seriesName: 'Elite Series',
      price: 280000,
      priority: 4,
      todaysStock: 8,
      stockPlus360Days: 30,
      brand: 'Probodyline',
      warranty: '2 years warranty on parts and labor',
      keyword: ['elliptical', 'cardio', 'cross trainer', 'low impact'],
      packagingDescription: ['Partially Assembled', 'Requires Setup'],
      notes: 'Smooth elliptical motion with adjustable resistance levels and built-in workout programs.',
      image: generatePlaceholderImage('Probodyline Elliptical Trainer Elite'),
      images: [
        generatePlaceholderImage('Elliptical Front View'),
        generatePlaceholderImage('Elliptical Console'),
      ],
    },
    {
      name: 'Probodyline Stationary Bike Pro',
      modelNumber: 'PB-SB-2000',
      categoryId: cardioCategory?.id,
      productType: 'Cardio',
      seriesName: 'Pro Series',
      price: 35000,
      priority: 3,
      todaysStock: 25,
      stockPlus360Days: 80,
      brand: 'Probodyline',
      warranty: '1 year warranty',
      keyword: ['bike', 'cycle', 'cardio', 'indoor cycling', 'exercise bike'],
      packagingDescription: ['Fully Assembled'],
      notes: 'Compact design perfect for home use with magnetic resistance system.',
      image: generatePlaceholderImage('Probodyline Stationary Bike Pro'),
      images: [
        generatePlaceholderImage('Stationary Bike Front'),
        generatePlaceholderImage('Stationary Bike Side'),
      ],
    },
    {
      name: 'Probodyline Rowing Machine Commercial',
      modelNumber: 'PB-RM-4000',
      categoryId: cardioCategory?.id,
      productType: 'Cardio',
      seriesName: 'Commercial Series',
      price: 185000,
      priority: 4,
      todaysStock: 5,
      stockPlus360Days: 20,
      brand: 'Probodyline',
      warranty: '3 years commercial warranty',
      keyword: ['rowing', 'cardio', 'full body', 'commercial'],
      packagingDescription: ['Requires Assembly', 'Heavy Duty'],
      notes: 'Commercial grade rowing machine with water resistance system for authentic rowing experience.',
      image: generatePlaceholderImage('Probodyline Rowing Machine Commercial'),
      images: [
        generatePlaceholderImage('Rowing Machine Front'),
        generatePlaceholderImage('Rowing Machine Side'),
      ],
    },
    {
      name: 'Probodyline Leg Press Machine 2000',
      modelNumber: 'PB-LP-2000',
      categoryId: strengthCategory?.id,
      productType: 'Strength',
      seriesName: 'Commercial Series',
      price: 320000,
      priority: 5,
      todaysStock: 6,
      stockPlus360Days: 25,
      brand: 'Probodyline',
      warranty: '2 years commercial warranty',
      keyword: ['leg press', 'strength', 'legs', 'lower body', 'commercial'],
      packagingDescription: ['Requires Assembly', 'Commercial Grade'],
      notes: 'Heavy-duty leg press machine with adjustable seat and weight stack up to 300kg.',
      cousinMachine: 'Probodyline Leg Extension Machine',
      image: generatePlaceholderImage('Probodyline Leg Press Machine 2000'),
      images: [
        generatePlaceholderImage('Leg Press Front'),
        generatePlaceholderImage('Leg Press Side'),
        generatePlaceholderImage('Leg Press Weight Stack'),
      ],
    },
    {
      name: 'Probodyline Chest Press Machine',
      modelNumber: 'PB-CP-1500',
      categoryId: strengthCategory?.id,
      productType: 'Strength',
      seriesName: 'Professional Series',
      price: 195000,
      priority: 4,
      todaysStock: 10,
      stockPlus360Days: 35,
      brand: 'Probodyline',
      warranty: '2 years warranty',
      keyword: ['chest press', 'pectorals', 'upper body', 'strength'],
      packagingDescription: ['Partially Assembled'],
      notes: 'Isolated chest press machine with adjustable seat height and weight stack.',
      image: generatePlaceholderImage('Probodyline Chest Press Machine'),
      images: [
        generatePlaceholderImage('Chest Press Front'),
        generatePlaceholderImage('Chest Press Side'),
      ],
    },
    {
      name: 'Probodyline Lat Pulldown Machine',
      modelNumber: 'PB-LAT-1800',
      categoryId: strengthCategory?.id,
      productType: 'Strength',
      seriesName: 'Commercial Series',
      price: 220000,
      priority: 4,
      todaysStock: 7,
      stockPlus360Days: 28,
      brand: 'Probodyline',
      warranty: '2 years commercial warranty',
      keyword: ['lat pulldown', 'back', 'lats', 'upper body', 'pulling'],
      packagingDescription: ['Requires Assembly'],
      notes: 'Commercial lat pulldown machine with adjustable knee pad and multiple grip options.',
      image: generatePlaceholderImage('Probodyline Lat Pulldown Machine'),
      images: [
        generatePlaceholderImage('Lat Pulldown Front'),
        generatePlaceholderImage('Lat Pulldown Side'),
      ],
    },
    {
      name: 'Probodyline Shoulder Press Machine',
      modelNumber: 'PB-SP-1200',
      categoryId: strengthCategory?.id,
      productType: 'Strength',
      seriesName: 'Professional Series',
      price: 165000,
      priority: 3,
      todaysStock: 9,
      stockPlus360Days: 32,
      brand: 'Probodyline',
      warranty: '2 years warranty',
      keyword: ['shoulder press', 'deltoids', 'shoulders', 'upper body'],
      packagingDescription: ['Partially Assembled'],
      notes: 'Isolated shoulder press machine with adjustable seat and weight stack.',
      image: generatePlaceholderImage('Probodyline Shoulder Press Machine'),
      images: [
        generatePlaceholderImage('Shoulder Press Front'),
        generatePlaceholderImage('Shoulder Press Side'),
      ],
    },
    {
      name: 'Probodyline Smith Machine Pro',
      modelNumber: 'PB-SM-3000',
      categoryId: strengthCategory?.id,
      productType: 'Strength',
      seriesName: 'Professional Series',
      price: 380000,
      priority: 5,
      todaysStock: 4,
      stockPlus360Days: 18,
      brand: 'Probodyline',
      warranty: '3 years commercial warranty',
      keyword: ['smith machine', 'multi-functional', 'squat', 'bench press', 'versatile'],
      packagingDescription: ['Requires Professional Assembly', 'Heavy Duty'],
      notes: 'Multi-functional Smith machine with safety catches, adjustable bench, and weight storage.',
      orderTogether: 'Probodyline Olympic Barbell Set',
      image: generatePlaceholderImage('Probodyline Smith Machine Pro'),
      images: [
        generatePlaceholderImage('Smith Machine Front'),
        generatePlaceholderImage('Smith Machine Side'),
        generatePlaceholderImage('Smith Machine Bench'),
      ],
    },
    {
      name: 'Probodyline Bicep Curl Machine',
      modelNumber: 'PB-BC-800',
      categoryId: strengthCategory?.id,
      productType: 'Strength',
      seriesName: 'Isolation Series',
      price: 95000,
      priority: 2,
      todaysStock: 15,
      stockPlus360Days: 50,
      brand: 'Probodyline',
      warranty: '1 year warranty',
      keyword: ['bicep curl', 'biceps', 'arms', 'isolation', 'upper body'],
      packagingDescription: ['Fully Assembled'],
      notes: 'Isolated bicep curl machine with adjustable seat and arm pad.',
      image: generatePlaceholderImage('Probodyline Bicep Curl Machine'),
      images: [
        generatePlaceholderImage('Bicep Curl Front'),
        generatePlaceholderImage('Bicep Curl Side'),
      ],
    },
    {
      name: 'Probodyline Tricep Extension Machine',
      modelNumber: 'PB-TE-850',
      categoryId: strengthCategory?.id,
      productType: 'Strength',
      seriesName: 'Isolation Series',
      price: 98000,
      priority: 2,
      todaysStock: 14,
      stockPlus360Days: 48,
      brand: 'Probodyline',
      warranty: '1 year warranty',
      keyword: ['tricep extension', 'triceps', 'arms', 'isolation', 'upper body'],
      packagingDescription: ['Fully Assembled'],
      notes: 'Isolated tricep extension machine with comfortable seat and adjustable arm pad.',
      image: generatePlaceholderImage('Probodyline Tricep Extension Machine'),
      images: [
        generatePlaceholderImage('Tricep Extension Front'),
        generatePlaceholderImage('Tricep Extension Side'),
      ],
    },
    {
      name: 'Probodyline Leg Curl Machine',
      modelNumber: 'PB-LC-900',
      categoryId: strengthCategory?.id,
      productType: 'Strength',
      seriesName: 'Isolation Series',
      price: 125000,
      priority: 3,
      todaysStock: 11,
      stockPlus360Days: 40,
      brand: 'Probodyline',
      warranty: '1 year warranty',
      keyword: ['leg curl', 'hamstrings', 'legs', 'isolation', 'lower body'],
      packagingDescription: ['Partially Assembled'],
      notes: 'Seated leg curl machine for isolated hamstring training with adjustable weight stack.',
      cousinMachine: 'Probodyline Leg Extension Machine',
      image: generatePlaceholderImage('Probodyline Leg Curl Machine'),
      images: [
        generatePlaceholderImage('Leg Curl Front'),
        generatePlaceholderImage('Leg Curl Side'),
      ],
    },
    {
      name: 'Probodyline Leg Extension Machine',
      modelNumber: 'PB-LE-950',
      categoryId: strengthCategory?.id,
      productType: 'Strength',
      seriesName: 'Isolation Series',
      price: 128000,
      priority: 3,
      todaysStock: 11,
      stockPlus360Days: 40,
      brand: 'Probodyline',
      warranty: '1 year warranty',
      keyword: ['leg extension', 'quadriceps', 'legs', 'isolation', 'lower body'],
      packagingDescription: ['Partially Assembled'],
      notes: 'Seated leg extension machine for isolated quadriceps training with adjustable weight stack.',
      cousinMachine: 'Probodyline Leg Curl Machine',
      image: generatePlaceholderImage('Probodyline Leg Extension Machine'),
      images: [
        generatePlaceholderImage('Leg Extension Front'),
        generatePlaceholderImage('Leg Extension Side'),
      ],
    },
    {
      name: 'Probodyline Seated Row Machine',
      modelNumber: 'PB-SR-1600',
      categoryId: strengthCategory?.id,
      productType: 'Strength',
      seriesName: 'Commercial Series',
      price: 175000,
      priority: 4,
      todaysStock: 8,
      stockPlus360Days: 30,
      brand: 'Probodyline',
      warranty: '2 years commercial warranty',
      keyword: ['seated row', 'back', 'rhomboids', 'upper body', 'pulling'],
      packagingDescription: ['Requires Assembly'],
      notes: 'Commercial seated row machine with adjustable chest pad and multiple grip handles.',
      image: generatePlaceholderImage('Probodyline Seated Row Machine'),
      images: [
        generatePlaceholderImage('Seated Row Front'),
        generatePlaceholderImage('Seated Row Side'),
      ],
    },
    {
      name: 'Probodyline Cable Crossover System',
      modelNumber: 'PB-CC-5000',
      categoryId: functionalCategory?.id,
      productType: 'Functional',
      seriesName: 'Multi-Station Series',
      price: 550000,
      priority: 5,
      todaysStock: 3,
      stockPlus360Days: 12,
      brand: 'Probodyline',
      warranty: '3 years commercial warranty',
      keyword: ['cable crossover', 'functional', 'multi-station', 'versatile', 'cables'],
      packagingDescription: ['Requires Professional Installation', 'Commercial Grade'],
      notes: 'Multi-station cable crossover system with dual weight stacks, adjustable pulleys, and multiple exercise stations.',
      swapMachine: 'Probodyline Smith Machine Pro',
      image: generatePlaceholderImage('Probodyline Cable Crossover System'),
      images: [
        generatePlaceholderImage('Cable Crossover Front'),
        generatePlaceholderImage('Cable Crossover Side'),
        generatePlaceholderImage('Cable Crossover Stations'),
      ],
    },
  ];

  // Get the last product's srNo to continue numbering
  const lastProduct = await prisma.product.findFirst({
    orderBy: { srNo: 'desc' },
  });
  let nextSrNo = lastProduct ? lastProduct.srNo + 1 : 1;

  // Create or update products
  for (const productData of products) {
    // Check if product already exists by model number
    const existing = await prisma.product.findFirst({
      where: { modelNumber: productData.modelNumber },
    });

    if (!existing) {
      await prisma.product.create({
        data: {
          srNo: nextSrNo++,
          name: productData.name,
          modelNumber: productData.modelNumber,
          categoryId: productData.categoryId,
          productType: productData.productType,
          seriesName: productData.seriesName,
          price: productData.price,
          priority: productData.priority,
          todaysStock: productData.todaysStock,
          stockPlus360Days: productData.stockPlus360Days,
          brand: productData.brand,
          warranty: productData.warranty,
          keyword: productData.keyword,
          packagingDescription: productData.packagingDescription,
          notes: productData.notes,
          cousinMachine: productData.cousinMachine,
          orderTogether: productData.orderTogether,
          swapMachine: productData.swapMachine,
          image: productData.image,
          images: productData.images || [],
        },
      });
    } else {
      // Update existing product with images if they're missing
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          image: productData.image || existing.image,
          images: productData.images && productData.images.length > 0 ? productData.images : existing.images,
        },
      });
    }
  }

  console.log(`✅ Created ${products.length} products`);

  console.log('🌱 Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

