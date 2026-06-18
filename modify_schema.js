const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Update UserRole
schema = schema.replace(
  /enum UserRole \{[\s\S]*?\}/,
  `enum UserRole {
  ADMIN
  HOD_TECHNICAL
  SALES
  STAFF
}`
);

// Update User Model
schema = schema.replace(
  /model User \{[\s\S]*?@@map\("users"\)\n\}/,
  (match) => {
    let newModel = match.replace(
      '// Relations',
      `// Relations\n  managerId      String?\n  manager        User?     @relation("UserManager", fields: [managerId], references: [id], onDelete: SetNull)\n  team           User[]    @relation("UserManager")`
    );
    // Add relation arrays for createdBy
    let relations = [
      `  createdQuotations Quotation[]`,
      `  createdSalesOrders SalesOrder[]`,
      `  createdPurchaseOrders PurchaseOrder[]`,
      `  createdServiceCards ServiceCard[]`,
      `  createdLeads Lead[]`,
      `  createdClients Client[]`,
      `  createdGyms Gym[]`,
      `  createdChallans Challan[]`,
      `  createdStockTransactions StockTransaction[]`,
      `  createdInaugurationCommitments InaugurationCommitment[]`,
      `  createdCalendarEvents CalendarEvent[]`
    ].join('\n');
    return newModel.replace('@@map("users")', relations + '\n\n  @@map("users")');
  }
);

// Add createdBy to Quotation
schema = schema.replace(/model Quotation \{[\s\S]*?@@map\("quotations"\)\n\}/, match => {
  if (!match.includes('createdBy String?')) {
    match = match.replace('createdAt      DateTime', `createdBy      String?\n  createdByUser  User?    @relation(fields: [createdBy], references: [id])\n  createdAt      DateTime`);
  }
  return match;
});

// Add createdBy to SalesOrder
schema = schema.replace(/model SalesOrder \{[\s\S]*?@@map\("sales_orders"\)\n\}/, match => {
  if (!match.includes('createdBy String?')) {
    match = match.replace('createdAt    DateTime', `createdBy      String?\n  createdByUser  User?    @relation(fields: [createdBy], references: [id])\n  createdAt    DateTime`);
  }
  return match;
});

// Add createdBy to PurchaseOrder
schema = schema.replace(/model PurchaseOrder \{[\s\S]*?@@map\("purchase_orders"\)\n\}/, match => {
  if (!match.includes('createdBy String?')) {
    match = match.replace('createdAt    DateTime', `createdBy      String?\n  createdByUser  User?    @relation(fields: [createdBy], references: [id])\n  createdAt    DateTime`);
  }
  return match;
});

// Add createdBy to ServiceCard
schema = schema.replace(/model ServiceCard \{[\s\S]*?@@map\("service_cards"\)\n\}/, match => {
  if (!match.includes('createdBy String?')) {
    match = match.replace('createdAt DateTime', `createdBy      String?\n  createdByUser  User?    @relation(fields: [createdBy], references: [id])\n  createdAt DateTime`);
  }
  return match;
});

// Add createdBy to Lead
schema = schema.replace(/model Lead \{[\s\S]*?@@map\("leads"\)\n\}/, match => {
  if (!match.includes('createdBy String?')) {
    match = match.replace('createdAt  DateTime', `createdBy      String?\n  createdByUser  User?    @relation(fields: [createdBy], references: [id])\n  createdAt  DateTime`);
  }
  return match;
});

// Add createdBy to Client
schema = schema.replace(/model Client \{[\s\S]*?@@map\("clients"\)\n\}/, match => {
  if (!match.includes('createdBy String?')) {
    match = match.replace('createdAt       DateTime', `createdBy       String?\n  createdByUser   User?    @relation(fields: [createdBy], references: [id])\n  createdAt       DateTime`);
  }
  return match;
});

// Add createdBy to Gym
schema = schema.replace(/model Gym \{[\s\S]*?@@map\("gyms"\)\n\}/, match => {
  if (!match.includes('createdBy String?')) {
    match = match.replace('createdAt        DateTime', `createdBy        String?\n  createdByUser    User?    @relation(fields: [createdBy], references: [id])\n  createdAt        DateTime`);
  }
  return match;
});

// Add createdBy to Challan
schema = schema.replace(/model Challan \{[\s\S]*?@@map\("challans"\)\n\}/, match => {
  if (!match.includes('createdBy String?')) {
    match = match.replace('createdAt DateTime', `createdBy      String?\n  createdByUser  User?    @relation(fields: [createdBy], references: [id])\n  createdAt DateTime`);
  }
  return match;
});

// Fix existing StockTransaction
schema = schema.replace(/model StockTransaction \{[\s\S]*?@@map\("stock_transactions"\)\n\}/, match => {
  if (match.includes('createdBy       String?') && !match.includes('createdByUser')) {
    match = match.replace('createdBy       String? // FK to User (future)', `createdBy       String?\n  createdByUser   User?    @relation(fields: [createdBy], references: [id])`);
  }
  return match;
});

// Fix existing InaugurationCommitment
schema = schema.replace(/model InaugurationCommitment \{[\s\S]*?@@map\("inauguration_commitments"\)\n\}/, match => {
  if (match.includes('createdBy    String?') && !match.includes('createdByUser')) {
    match = match.replace('createdBy    String?', `createdBy    String?\n  createdByUser User?    @relation(fields: [createdBy], references: [id])`);
  }
  return match;
});

// Fix existing CalendarEvent
schema = schema.replace(/model CalendarEvent \{[\s\S]*?@@map\("calendar_events"\)\n\}/, match => {
  if (match.includes('createdBy String?') && !match.includes('createdByUser')) {
    match = match.replace('createdBy String?', `createdBy String?\n  createdByUser User?    @relation(fields: [createdBy], references: [id])`);
  }
  return match;
});

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema updated successfully');
